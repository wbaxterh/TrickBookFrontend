/**
 * Voice input hook — mirrors the web stage's SpeechRecognition behavior
 * (kaori-live.js toggleVoiceInput): live interim transcript, auto-submit
 * after 2s of silence, manual stop submits what was heard.
 */

import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';

const SILENCE_TIMEOUT_MS = 2000;

export interface VoiceInputOptions {
  /** Live transcript (interim + finals) — mirror into the input field. */
  onTranscript: (text: string) => void;
  /** Fired once after silence/manual stop with the final utterance. */
  onSubmit: (text: string) => void;
  /** Listening started/stopped — hook point for barge-in. */
  onListeningChange?: (listening: boolean) => void;
}

export function useVoiceInput(options: VoiceInputOptions) {
  const [listening, setListening] = useState(false);
  const finalText = useRef('');
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const clearSilenceTimer = () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = null;
  };

  const resetSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimer.current = setTimeout(() => {
      // Silent for 2s — done talking; "end" event finalizes + submits
      ExpoSpeechRecognitionModule.stop();
    }, SILENCE_TIMEOUT_MS);
  };

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      finalText.current = `${finalText.current} ${transcript}`.trim();
      optionsRef.current.onTranscript(finalText.current);
    } else {
      optionsRef.current.onTranscript(`${finalText.current} ${transcript}`.trim());
    }
    resetSilenceTimer();
  });

  useSpeechRecognitionEvent('start', () => {
    setListening(true);
    optionsRef.current.onListeningChange?.(true);
  });

  useSpeechRecognitionEvent('end', () => {
    clearSilenceTimer();
    setListening(false);
    optionsRef.current.onListeningChange?.(false);
    const text = finalText.current.trim();
    finalText.current = '';
    if (text) optionsRef.current.onSubmit(text);
  });

  useSpeechRecognitionEvent('error', (event) => {
    // 'no-speech' is normal — user hasn't said anything yet
    if (event.error !== 'no-speech') {
      clearSilenceTimer();
      setListening(false);
      optionsRef.current.onListeningChange?.(false);
    }
  });

  const toggleVoiceInput = useCallback(async () => {
    if (listening) {
      // Manual stop — "end" event submits whatever was heard
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permissions.granted) return;

    finalText.current = '';
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
      requiresOnDeviceRecognition: false,
    });
    // If the user never speaks, stop after 5s (matches web behavior)
    silenceTimer.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), 5000);
  }, [listening]);

  return { listening, toggleVoiceInput };
}
