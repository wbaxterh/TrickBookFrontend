/**
 * useKithVoice — owns the Kith WebSocket session, the gapless TTS player,
 * and the shared CompanionVoiceState ref that drives the 3D character.
 *
 * Event → animation mapping (mirrors kaori-live.js):
 *  tts_start → speaking · queue-drain grace → idle
 *  emotion_state → expression layer · barge_in → listening
 *
 * Kith speaks a reply SENTENCE BY SENTENCE (one turn cycle per sentence).
 * The hook counts assistant sentence starts so callers can synchronize
 * choreography with what Kaori is currently saying.
 */

import { useEffect, useRef, useState } from 'react';
import {
  type CompanionEmotion,
  type CompanionVoiceState,
  createVoiceState,
} from '@/components/companion/KaoriStage';
import { API_CONFIG } from '@/constants/api';
import { type KithEvent, KithVoiceSession } from '@/lib/companion/kithVoice';
import { TtsPlayer } from '@/lib/companion/ttsPlayer';

const KITH_EMOTIONS: Record<string, CompanionEmotion> = {
  neutral: 'neutral',
  excited: 'excited',
  calm: 'calm',
  happy: 'happy',
  sad: 'sad',
};

export interface KithVoiceCallbacks {
  /** Fired when Kaori starts SPEAKING sentence n (0-based) of the reply. */
  onAssistantSentence?: (index: number) => void;
  /** Fired when the reply's audio has fully finished playing. */
  onReplyDone?: () => void;
}

export function useKithVoice(callbacks?: KithVoiceCallbacks) {
  const voiceState = useRef<CompanionVoiceState>(createVoiceState());
  const playerRef = useRef<TtsPlayer | null>(null);
  const sessionRef = useRef<KithVoiceSession | null>(null);
  const sentenceIndex = useRef(0);
  const callbacksRef = useRef<KithVoiceCallbacks | undefined>(callbacks);
  callbacksRef.current = callbacks;
  const [voiceReady, setVoiceReady] = useState(false);

  useEffect(() => {
    const player = new TtsPlayer();
    playerRef.current = player;
    player.onDrained = () => {
      if (voiceState.current.mode === 'speaking') {
        voiceState.current.mode = 'idle';
      }
      callbacksRef.current?.onReplyDone?.();
    };

    const applyEvent = (event: KithEvent) => {
      switch (event.type) {
        case '_ready':
          setVoiceReady(true);
          break;
        case 'turn_start':
          if (event.role === 'assistant') {
            callbacksRef.current?.onAssistantSentence?.(sentenceIndex.current);
            sentenceIndex.current += 1;
          }
          break;
        case 'tts_start':
          voiceState.current.mode = 'speaking';
          break;
        case 'tts_audio_chunk':
          if (event.audioB64) {
            voiceState.current.mode = 'speaking';
            player.enqueueChunk(event.audioB64);
          }
          break;
        // tts_end/turn_end are per-sentence boundaries — end-of-reply is
        // detected by the player's queue-drain grace (onDrained).
        case 'emotion_state':
          voiceState.current.emotion = KITH_EMOTIONS[event.state ?? ''] ?? 'neutral';
          voiceState.current.emotionIntensity =
            typeof event.intensity === 'number' ? event.intensity : 0;
          break;
        case 'barge_in_detected':
          player.interrupt();
          voiceState.current.mode = 'listening';
          break;
        default:
          break;
      }
    };

    const session = new KithVoiceSession(API_CONFIG.kithWsUrl, applyEvent);
    session.connect();
    sessionRef.current = session;

    return () => {
      session.destroy();
      player.destroy();
      playerRef.current = null;
      sessionRef.current = null;
    };
  }, []);

  return {
    /** Shared mutable state — pass to <KaoriStage voiceState={...}> */
    voiceState,
    /** True once the Kith session is live (voice available). */
    voiceReady,
    /** Current session id for the x-kith-session request header. */
    getSessionId: () => sessionRef.current?.sessionId ?? '',
    /** Call when sending a message — resets the sentence counter. */
    beginReply: () => {
      sentenceIndex.current = 0;
    },
    /** User is about to talk / wants Kaori to stop. */
    bargeIn: () => {
      playerRef.current?.interrupt();
      sessionRef.current?.bargeIn();
    },
    /** Restore the playback audio session after the mic releases it. */
    reassertPlayback: () => playerRef.current?.reassertSession(),
    setMode: (mode: CompanionVoiceState['mode']) => {
      voiceState.current.mode = mode;
    },
  };
}
