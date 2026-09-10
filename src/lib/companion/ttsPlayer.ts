/**
 * Gapless streamed-TTS player.
 *
 * Kith streams independently-decodable mp3_44100_128 chunks (base64) over
 * WebSocket — one full turn cycle PER SENTENCE (turn_start → tts_start →
 * chunk → tts_end → turn_end). A single native AudioBufferQueueSourceNode
 * lives for the whole conversation: it plays whatever is queued, renders
 * silence while empty, and resumes when the next sentence arrives — that
 * makes sentence boundaries gapless and avoids per-turn node leaks (a
 * drained queue node never reaches FINISHED, so per-turn nodes would stay
 * alive forever).
 *
 * Library quirks this code works around (react-native-audio-api 0.13.1):
 *  - `start()` with no args THROWS (default offset -1 trips the arg
 *    guard) — must call start(0, 0).
 *  - `onEnded` never fires for queue nodes; drain detection must use
 *    `onBufferEnded` + `isLastBufferInQueue`.
 *  - react-native-worklets is pinned to 0.5.1 (Expo SDK 54) which is
 *    below audio-api's optional >=0.6 peer — its worklet nodes are
 *    disabled at build time. This player only uses decodeAudioData +
 *    AudioBufferQueueSourceNode, which don't need worklets. Do NOT bump
 *    worklets to silence the build warning.
 *
 * Decodes are serialized on a promise chain: decodeAudioData resolves out
 * of order otherwise and would scramble speech.
 */

import { AudioContext, AudioManager } from 'react-native-audio-api';

type QueueNode = ReturnType<AudioContext['createBufferQueueSource']>;

/** Silence gap after the last queued buffer before we call the turn done. */
// End-of-reply is inferred when the audio queue stays empty for this long.
// Must tolerate the gap between one sentence draining and Kith generating the
// next sentence's audio — 500ms was too tight and ended multi-sentence replies
// early (e.g. trick demos stopping after "wind up").
const DRAIN_IDLE_GRACE_MS = 2000;

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = global.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function configurePlaybackSession() {
  // Play through the ringer switch; spoken-audio mode tunes buffering
  AudioManager.setAudioSessionOptions({ iosCategory: 'playback', iosMode: 'spokenAudio' });
  AudioManager.setAudioSessionActivity(true);
}

export class TtsPlayer {
  private context: AudioContext | null = null;
  private queueNode: QueueNode | null = null;
  private started = false;
  private chain: Promise<void> = Promise.resolve();
  private generation = 0;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;

  /** Fires when the reply's audio has fully drained (plus a short grace). */
  onDrained?: () => void;

  private ensureContext(): AudioContext {
    if (!this.context) {
      configurePlaybackSession();
      // Match mp3_44100_128 to avoid resampling
      this.context = new AudioContext({ sampleRate: 44100 });
    }
    return this.context;
  }

  /**
   * Re-assert the playback audio session — speech recognition swaps the
   * session to playAndRecord/measurement while the mic is open and never
   * restores it.
   */
  reassertSession() {
    configurePlaybackSession();
  }

  private cancelDrainTimer() {
    if (this.drainTimer) {
      clearTimeout(this.drainTimer);
      this.drainTimer = null;
    }
  }

  /**
   * Signal that another assistant sentence has begun (Kith `turn_start`), so the
   * reply is NOT over — cancel any pending end-of-reply drain timer even though
   * this sentence's audio hasn't arrived yet. turn_start precedes the audio
   * chunks, so this closes the window where a slow next-sentence would let the
   * drain grace fire and end the reply early.
   */
  keepAlive() {
    this.cancelDrainTimer();
  }

  private scheduleDrainIdle() {
    this.cancelDrainTimer();
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      this.onDrained?.();
    }, DRAIN_IDLE_GRACE_MS);
  }

  private ensureNode(ctx: AudioContext): QueueNode {
    if (!this.queueNode) {
      const node = ctx.createBufferQueueSource();
      node.connect(ctx.destination);
      node.onBufferEnded = (event: { isLastBufferInQueue?: boolean }) => {
        // Queue ran dry — if no new sentence arrives shortly, the reply
        // is over. A new enqueue cancels the timer.
        if (event?.isLastBufferInQueue) this.scheduleDrainIdle();
      };
      this.queueNode = node;
      this.started = false;
    }
    return this.queueNode;
  }

  /** Enqueue one base64 mp3 chunk (call per tts_audio_chunk event). */
  enqueueChunk(audioB64: string) {
    const generation = this.generation;
    this.cancelDrainTimer();
    this.chain = this.chain.then(async () => {
      if (generation !== this.generation) return; // interrupted mid-decode
      try {
        const ctx = this.ensureContext();
        const node = this.ensureNode(ctx);
        const buffer = await ctx.decodeAudioData(base64ToArrayBuffer(audioB64));
        if (generation !== this.generation) return;
        this.cancelDrainTimer();
        node.enqueueBuffer(buffer);
        if (!this.started) {
          // start() with no args throws in 0.13.1 — offset must be 0
          node.start(0, 0);
          this.started = true;
        }
      } catch (error) {
        console.warn('[TtsPlayer] chunk decode/enqueue failed:', error);
      }
    });
  }

  /** Hard stop (barge-in): drop queued audio immediately. */
  interrupt() {
    this.generation += 1;
    this.cancelDrainTimer();
    const node = this.queueNode;
    this.queueNode = null;
    this.started = false;
    this.chain = Promise.resolve();
    if (node) {
      node.onBufferEnded = null;
      try {
        node.stop();
      } catch {
        // already stopped
      }
    }
  }

  destroy() {
    this.interrupt();
    this.context?.close();
    this.context = null;
  }
}
