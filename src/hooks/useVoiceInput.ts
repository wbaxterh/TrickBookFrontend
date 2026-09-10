/**
 * Voice input hook — mirrors the web stage's SpeechRecognition behavior
 * (kaori-live.js toggleVoiceInput): live interim transcript, auto-submit
 * after 2s of silence, manual stop submits what was heard.
 *
 * Two modes:
 *  - manual (toggleVoiceInput): press-to-talk; if the user never speaks it
 *    auto-stops after 5s (matches the web button behavior).
 *  - hands-free (startVoiceInput({ handsFree: true })): the mic stays open
 *    until the user actually speaks (then 2s of silence submits). Used by the
 *    3D stage so you can just talk — no button press. The caller reopens it
 *    after each of Kaori's replies.
 */

import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';

const SILENCE_TIMEOUT_MS = 2000;
const NO_SPEECH_TIMEOUT_MS = 5000;

// Bias iOS recognition toward rider vocabulary — without these, trick names
// come back as near-homophones ("wild cat", "tame dog", "back site")
// that detectTrickId can't match.
const RIDER_VOCABULARY = [
  'Kaori',
  'TrickBook',
  'frontside',
  'backside',
  'frontside 360',
  'backside 360',
  'three sixty',
  'five forty',
  'seven twenty',
  'ten eighty',
  'back 3',
  'front 3',
  'half cab',
  'cab 360',
  'wildcat',
  'tamedog',
  'tame dog',
  'backflip',
  'frontflip',
  'rodeo',
  'cork',
  'snowboard',
  'ollie',
  'nollie',
  'butter',
  'nose press',
  'tail press',
  'nose roll',
  'tail roll',
  'tripod',
  'boardslide',
  'fifty fifty',
  'carve',
  'indy',
  'nosebone',
  'weddle',
  'mute grab',
  'melon',
  'method',
  'nose grab',
  'tail grab',
  'stalefish',
  'japan grab',
  'crail',
  'roast beef',
  'chicken salad',
  'canadian bacon',
  'seatbelt grab',
  'taipan',
  'straight air',
  'fakie',
  'switch',
  'goofy',
  'regular',
];

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
  // Ref mirror so the start/stop callbacks stay stable and never read a stale
  // `listening` — the hands-free loop calls them from effects.
  const listeningRef = useRef(false);
  const pendingStart = useRef(false);
  const finalText = useRef('');
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const setListen = useCallback((value: boolean) => {
    listeningRef.current = value;
    setListening(value);
  }, []);

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
    if (__DEV__)
      console.log('[stt]', event.isFinal ? 'FINAL' : 'interim', JSON.stringify(transcript));
    if (event.isFinal) {
      finalText.current = `${finalText.current} ${transcript}`.trim();
      optionsRef.current.onTranscript(finalText.current);
    } else {
      optionsRef.current.onTranscript(`${finalText.current} ${transcript}`.trim());
    }
    resetSilenceTimer();
  });

  useSpeechRecognitionEvent('start', () => {
    pendingStart.current = false;
    setListen(true);
    optionsRef.current.onListeningChange?.(true);
  });

  useSpeechRecognitionEvent('end', () => {
    pendingStart.current = false;
    clearSilenceTimer();
    setListen(false);
    optionsRef.current.onListeningChange?.(false);
    const text = finalText.current.trim();
    finalText.current = '';
    if (text) optionsRef.current.onSubmit(text);
  });

  useSpeechRecognitionEvent('error', (event) => {
    // 'no-speech' is normal — user hasn't said anything yet
    if (event.error !== 'no-speech') {
      pendingStart.current = false;
      clearSilenceTimer();
      setListen(false);
      optionsRef.current.onListeningChange?.(false);
    }
  });

  const startVoiceInput = useCallback(async (opts?: { handsFree?: boolean }) => {
    // Guard against double-starts — the hands-free loop can fire rapidly and
    // ExpoSpeechRecognitionModule.start() throws if already recognizing.
    if (listeningRef.current || pendingStart.current) return;
    pendingStart.current = true;
    try {
      const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permissions.granted) {
        pendingStart.current = false;
        return;
      }
      finalText.current = '';
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: false,
        contextualStrings: RIDER_VOCABULARY,
        // The library's default session mode is `measurement`, which disables
        // iOS mic processing (AGC + noise suppression) and wrecks accuracy.
        iosCategory: {
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
          mode: 'default',
        },
      });
      // Manual press-to-talk closes the mic if the user never speaks. Hands-free
      // leaves it open — it's the user's turn, so we wait for them.
      if (!opts?.handsFree) {
        silenceTimer.current = setTimeout(
          () => ExpoSpeechRecognitionModule.stop(),
          NO_SPEECH_TIMEOUT_MS,
        );
      }
    } catch {
      pendingStart.current = false;
    }
  }, []);

  const stopVoiceInput = useCallback(() => {
    if (!listeningRef.current && !pendingStart.current) return;
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const toggleVoiceInput = useCallback(async () => {
    if (listeningRef.current) {
      // Manual stop — "end" event submits whatever was heard
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    await startVoiceInput();
  }, [startVoiceInput]);

  return { listening, toggleVoiceInput, startVoiceInput, stopVoiceInput };
}
