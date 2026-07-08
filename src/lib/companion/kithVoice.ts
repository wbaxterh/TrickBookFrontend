/**
 * Kith voice session — WebSocket client for the Kith TTS sidecar.
 *
 * Protocol (kith-voice/src/server.ts):
 *  - connect to /ws → server sends { type: '_ready', sessionId }
 *  - client → server: { type: 'speak', text } | { type: 'barge-in' }
 *  - server → client: KithEvent JSON (tts_start / tts_audio_chunk /
 *    tts_end / turn_start / turn_end / emotion_state / barge_in_detected /
 *    stt_partial / stt_final / viseme_frame / reconnect / error)
 *
 * The sessionId is passed to the backend as the `x-kith-session` header on
 * POST /bot-chat/message; the backend then fires Kaori's reply text at
 * Kith, and the audio streams back over this socket.
 */

export interface KithEvent {
  type: string;
  sessionId?: string;
  turnId?: string;
  chunkId?: string;
  role?: 'user' | 'assistant';
  audioB64?: string;
  mimeType?: string;
  text?: string;
  state?: string;
  intensity?: number;
  message?: string;
  timestamp?: number;
}

const RECONNECT_DELAY_MS = 3000;

export class KithVoiceSession {
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  sessionId = '';

  constructor(
    private readonly url: string,
    private readonly onEvent: (event: KithEvent) => void,
  ) {}

  connect() {
    if (this.closed) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onmessage = (message) => {
      let event: KithEvent;
      try {
        event = JSON.parse(String(message.data));
      } catch {
        return;
      }
      if (event.type === '_ready' && event.sessionId) {
        this.sessionId = event.sessionId;
        if (__DEV__) console.log('[kith] session ready:', event.sessionId);
      }
      this.onEvent(event);
    };

    ws.onclose = (event) => {
      if (__DEV__) console.log('[kith] ws closed', event.code, event.reason || '');
      this.sessionId = '';
      this.ws = null;
      if (!this.closed) {
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      // onclose follows and handles the reconnect
    };
  }

  private send(payload: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  /** Ask Kith to speak text directly (bypasses the chat brain). */
  speak(text: string) {
    this.send({ type: 'speak', text });
  }

  /** Interrupt Kaori mid-speech (user started talking / tapped stop). */
  bargeIn() {
    this.send({ type: 'barge-in' });
  }

  destroy() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.sessionId = '';
  }
}
