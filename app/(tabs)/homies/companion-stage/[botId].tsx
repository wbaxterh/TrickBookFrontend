/**
 * Companion Stage Screen
 * Full-screen interactive 3D stage for the Kaori AI companion, with live
 * voice: talk (or type) to Kaori — same brain as the regular chat
 * (POST /bot-chat/message, logged in bot_chats), her reply streams back as
 * ElevenLabs audio via the Kith sidecar while the model speaks and emotes.
 */

import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createTrickDemoState,
  type DemoAction,
  KaoriStage,
  startAction,
  type TrickDemoState,
  type TrickId,
} from '@/components/companion';
import { brandColors } from '@/constants/colors';
import { useKithVoice } from '@/hooks/useKithVoice';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { apiClient } from '@/lib/api/client';

interface StageMessage {
  id: string;
  role: 'user' | 'kaori';
  text: string;
}

interface BotChatResponse {
  userMessage: { _id: string; message?: string };
  botMessage: { _id: string; message?: string };
}

const MODE_LABELS: Record<string, string> = {
  idle: 'idle',
  listening: 'listening…',
  thinking: 'thinking…',
  speaking: 'speaking',
};

/**
 * WHICH trick does this text name? Identification only — no demo-intent gate,
 * so it also works on Kaori's own reply ("...watch this backside 360...").
 * ORDERED most-specific-first: flips before spins ("backflip" contains "back"),
 * corks/rodeos before their spin degrees, named grabs before generic words.
 * Covers every Trickipedia snowboard trick in the TRICKS registry.
 */
const TRICK_CUES: [RegExp, TrickId][] = [
  // Flips
  [/\b(wildcat|back[\s-]?flip)\b/i, 'wildcat'],
  [/\b(tamedog|tame[\s-]?dog|front[\s-]?flip)\b/i, 'tamedog'],
  // Off-axis (before plain spins — "backside cork 720" must not match 720)
  [/\brodeo\b/i, 'backside-rodeo'],
  [/\b(frontside|fs)\s*cork\w*/i, 'frontside-cork'],
  [/\bcork\w*/i, 'backside-cork'],
  // Grabs (named)
  [/\b(indy\s*nose[\s-]?bone|nose[\s-]?bone)\b/i, 'indy-nosebone'],
  [/\bindy\b/i, 'indy'],
  [/\b(weddle|mute)\b/i, 'weddle'],
  [/\bmelon\b/i, 'melon'],
  [/\bmethod\b/i, 'method'],
  [/\bnose\s*grab\b/i, 'nose-grab'],
  [/\btail\s*grab\b/i, 'tail-grab'],
  [/\bstale[\s-]?fish\b/i, 'stalefish'],
  [/\bjapan\b/i, 'japan'],
  [/\bcrail\b/i, 'crail'],
  [/\broast\s*beef\b/i, 'roast-beef'],
  [/\bchicken\s*salad\b/i, 'chicken-salad'],
  [/\bcanadian\s*bacon\b/i, 'canadian-bacon'],
  [/\bseat[\s-]?belt\b/i, 'seatbelt'],
  [/\b(taipan|tai[\s-]?pan)\b/i, 'taipan'],
  // Jibs (before spins — "frontside boardslide" must not read as a spin)
  [/\b(fifty[\s-]?fifty|50[\s-]?50)\b/i, 'fifty-fifty'],
  [/\b(frontside|fs|front)\s*board[\s-]?slide\b|\bfront\s*board\b/i, 'frontside-boardslide'],
  [/\bboard[\s-]?slide\b/i, 'boardslide'],
  // Ground / flatland
  [/\bnollie\b/i, 'nollie'],
  [/\bollie\b/i, 'ollie'],
  [/\bnose\s*press\b/i, 'nose-press'],
  [/\btail\s*press\b/i, 'tail-press'],
  [/\bbutter\w*\b/i, 'butter'],
  [/\bnose\s*roll\b/i, 'nose-roll-180'],
  [/\btail\s*roll\b/i, 'tail-roll-180'],
  [/\btripod\b/i, 'tripod'],
  [/\b(carve[ds]?|carved?\s*turn)\b/i, 'carved-turn'],
  [/\b(ride|riding)\s*switch\b|\bswitch\s*(riding|stance)\b/i, 'ride-switch'],
  // Cab spins (switch frontside) — before plain spins ("cab 360" contains 360)
  [/\b(half[\s-]?cab|cab\s*(180|1))\b/i, 'cab-180'],
  [/\bcab(\s*360)?\b/i, 'cab-360'],
  // Spins by degree (backside variant checked inside each)
  [/\b(1080|ten[\s-]?eighty)\b/i, 'frontside-1080'],
  [/\b(900|nine[\s-]?(hundred|oh[\s-]?oh))\b/i, 'frontside-900'],
  [/\b(720|seven[\s-]?twenty)\b/i, 'frontside-720'],
  [/\b(540|five[\s-]?forty)\b/i, 'frontside-540'],
  [/\b(180|one[\s-]?eighty)\b|\b(front|back)side\s*1\b|\bback\s*1\b/i, 'frontside-180'],
  [
    /\b(360|three[\s-]?sixty|(front|back)side\s*3|(fs|bs)\s*3|back\s*3)\b/i,
    'frontside-360-stylish',
  ],
  // Bare "grab" / straight air
  [/\bgrab\b/i, 'indy'],
  [/\bstraight\s*air\b|\bair\s*out\b/i, 'straight-air'],
];

/** Swap a frontside spin id for its backside sibling when the text says so. */
const BS_SIBLING: Partial<Record<TrickId, TrickId>> = {
  'frontside-180': 'backside-180',
  'frontside-360-stylish': 'backside-360-stylish',
  'frontside-540': 'backside-540',
  'frontside-720': 'backside-720',
  'frontside-900': 'backside-900',
  'frontside-1080': 'backside-1080',
};

function detectTrickId(text: string): TrickId | null {
  for (const [re, id] of TRICK_CUES) {
    if (!re.test(text)) continue;
    const bs = BS_SIBLING[id];
    if (bs && /\b(backside|bs|back)\b/i.test(text) && !/\bfront(side)?\b/i.test(text)) return bs;
    return id;
  }
  return null;
}

/**
 * Detect "show me a trick" intents so Kaori demonstrates with her body while
 * she explains. Intent verb + a named trick → that trick.
 */
function detectTrickDemo(text: string): TrickId | null {
  const wantsDemo = /\b(show|demo|demonstrate|do|see|watch|hit|throw|bust|try|land)\b/i.test(text);
  return wantsDemo ? detectTrickId(text) : null;
}

/**
 * Enter the on-board demo session when the exchange cues one. The trick is
 * ALWAYS resolved — the user's explicit ask first, then any trick the user
 * named without a demo verb, then what her reply names, else the current one —
 * so a "back 3" never falls through to a stale/default frontside.
 */
function startDemoIfCued(
  text: string,
  reply: string | undefined,
  sessionId: string | null,
  demo: TrickDemoState,
  sentencesRef: { current: string[] | null },
) {
  const requestedTrick = detectTrickDemo(text);
  if (!reply) return;
  if (requestedTrick === null && !/watch this|let me show/i.test(reply)) return;
  demo.trick = requestedTrick ?? detectTrickId(text) ?? detectTrickId(reply) ?? demo.trick;
  if (__DEV__) console.log('[stage] demo trick:', demo.trick);
  demo.session = true;
  demo.idleT = 0;
  sentencesRef.current = splitSentences(reply);
  if (!sessionId) {
    // Voiceless fallback: no sentence cues will arrive — run the full trick
    // once, then step off the board.
    startAction(demo, 'full');
    setTimeout(() => {
      demo.session = false;
      sentencesRef.current = null;
    }, 7000);
  }
}

/** Split a reply the way Kith chunks speech — one sentence per turn. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Choreography cues: map what Kaori is SAYING to what her body does.
 * "watch this / let me show you / spin" → the full trick; phase keywords
 * → segment demos; anything else → she keeps talking in stance.
 */
function actionForSentence(sentence: string): Exclude<DemoAction, 'none'> | null {
  if (/watch|let me show|show you|check (this|it)|like this|here (we|it) go/i.test(sentence)) {
    return 'full';
  }
  // Any named trick in the sentence cues the full run (covers all 50 tricks).
  if (detectTrickId(sentence)) return 'full';
  if (/\b(flip|invert|somersault|spin|rotat\w*)\b/i.test(sentence)) return 'full';
  if (/\b(wind|coil|crouch|bend|set[\s-]?up|load)\b/i.test(sentence)) return 'setup';
  if (/\b(pop|jump|snap|spring)\b/i.test(sentence)) return 'pop';
  if (/\b(land\w*|absorb|stomp)\b/i.test(sentence)) return 'land';
  return null;
}

export default function CompanionStageScreen() {
  const { botId, name } = useLocalSearchParams<{ botId: string; name?: string }>();
  const isFocused = useIsFocused();

  const demoState = useRef(createTrickDemoState());
  const replySentences = useRef<string[] | null>(null);

  // True while the CURRENT listen was opened by the hands-free loop (vs a
  // deliberate mic-tap barge-in). Only hands-free listens are auto-closed
  // when Kaori's voice resumes. stopVoiceInput is declared below useKithVoice,
  // so the sentence callback reaches it through a ref (TDZ at render time).
  const handsFreeListen = useRef(false);
  const stopVoiceInputRef = useRef<() => void>(() => {});

  const {
    voiceState,
    voiceReady,
    getSessionId,
    bargeIn,
    stop,
    reassertPlayback,
    setMode,
    beginReply,
  } = useKithVoice({
    onAssistantSentence: (index) => {
      // Echo guard: per-sentence TTS gaps can outlast the player's drain
      // grace, so the hands-free mic may have reopened mid-reply — and an
      // open mic transcribes her own speaker audio as user input. Every
      // sentence announces itself here BEFORE its audio plays, so this is
      // the earliest place to shut a hands-free mic. Deliberate mic-tap
      // barge-ins (handsFreeListen=false) are left alone.
      if (handsFreeListen.current) stopVoiceInputRef.current();
      const sentences = replySentences.current;
      if (!sentences) return;
      const action = actionForSentence(sentences[index] ?? '');
      if (action) startAction(demoState.current, action);
    },
    onReplyDone: () => {
      demoState.current.session = false;
      replySentences.current = null;
    },
  });

  const [messages, setMessages] = useState<StageMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  // Re-render the state pill periodically-ish: mode changes are driven by
  // events; mirror them into React state where we know they change.
  const [modeLabel, setModeLabel] = useState('idle');
  const sendLock = useRef(false);

  const syncMode = useCallback(
    (mode: 'idle' | 'listening' | 'thinking' | 'speaking') => {
      setMode(mode);
      setModeLabel(mode);
    },
    [setMode],
  );

  // Kith events mutate voiceState outside React — mirror mode into the
  // pill. Same-value setState bails out, so this is render-free when idle.
  useEffect(() => {
    const id = setInterval(() => {
      setModeLabel((prev) => {
        const mode = voiceState.current.mode;
        return prev === mode ? prev : mode;
      });
    }, 400);
    return () => clearInterval(id);
  }, [voiceState]);

  const sendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || !botId || sendLock.current) return;
      sendLock.current = true;
      setSending(true);
      setInput('');
      setMessages((prev) => [...prev.slice(-6), { id: `u-${Date.now()}`, role: 'user', text }]);
      syncMode('thinking');

      try {
        const sessionId = getSessionId();
        beginReply();
        const response = await apiClient.post<BotChatResponse>(
          '/bot-chat/message',
          { botId, message: text },
          sessionId ? { headers: { 'x-kith-session': sessionId } } : undefined,
        );
        const reply = response?.botMessage?.message;
        if (reply) {
          setMessages((prev) => [
            ...prev.slice(-6),
            { id: `k-${Date.now()}`, role: 'kaori', text: reply },
          ]);
        }
        // Demo choreography: if the user asked for a demo (or her reply
        // announces one), she steps onto the board for the whole reply and
        // her sentences cue the moves (see onAssistantSentence).
        startDemoIfCued(text, reply, sessionId, demoState.current, replySentences);
        // Voice (if session live) arrives via Kith; tts_start flips the
        // mode to 'speaking'. Without voice, settle back to idle — and if
        // voice never arrives (dead session), recover after a beat.
        if (!sessionId) {
          syncMode('idle');
        } else {
          setTimeout(() => {
            if (voiceState.current.mode === 'thinking') syncMode('idle');
          }, 8000);
        }
      } catch (error) {
        if (__DEV__) console.warn('[stage] send failed:', error);
        syncMode('idle');
        setMessages((prev) => [
          ...prev.slice(-6),
          { id: `e-${Date.now()}`, role: 'kaori', text: "hmm, message didn't send — try again?" },
        ]);
      } finally {
        setSending(false);
        sendLock.current = false;
      }
    },
    [botId, getSessionId, syncMode, voiceState, beginReply],
  );

  const { listening, toggleVoiceInput, startVoiceInput, stopVoiceInput } = useVoiceInput({
    onTranscript: setInput,
    onSubmit: (text) => {
      sendMessage(text);
    },
    onListeningChange: (isListening) => {
      if (isListening) {
        syncMode('listening');
      } else {
        handsFreeListen.current = false;
        // Speech recognition leaves the audio session in record mode —
        // restore playback so the reply's TTS isn't attenuated.
        reassertPlayback();
        // Clear any leftover interim transcript so it doesn't sit in the field
        // and block the hands-free loop from reopening the mic. The submitted
        // utterance travels via onSubmit's arg, so nothing is lost here.
        setInput('');
        if (voiceState.current.mode === 'listening') syncMode('idle');
      }
    },
  });

  stopVoiceInputRef.current = stopVoiceInput;

  const handleMicPress = useCallback(() => {
    // Silence Kaori BEFORE the mic opens — otherwise her speaker output
    // bleeds into the head of the transcript.
    if (!listening) bargeIn();
    toggleVoiceInput();
  }, [listening, bargeIn, toggleVoiceInput]);

  // Greet on open: once the Kith voice session is live (and again each time the
  // stage is re-focused), Kaori SPEAKS a homie greeting — the backend fires Kith
  // /speak when it sees the x-kith-session header — and we show it as a bubble.
  // Ephemeral: not persisted to bot_chats. greetedRef resets on blur (below).
  const greetedRef = useRef(false);
  useEffect(() => {
    if (!isFocused || !voiceReady || !botId || greetedRef.current) return;
    greetedRef.current = true;
    // Claim the turn synchronously so the hands-free mic (below) stays shut
    // while she wakes up and greets — otherwise it opens on the idle frame
    // before her greeting audio starts and captures her own voice.
    syncMode('thinking');
    (async () => {
      try {
        const sessionId = getSessionId();
        beginReply();
        const res = await apiClient.post<{ greeting?: string }>(
          `/companion/profile/${botId}/greeting`,
          {},
          sessionId ? { headers: { 'x-kith-session': sessionId } } : undefined,
        );
        const greeting = res?.greeting;
        if (greeting) {
          setMessages((prev) => [
            ...prev.slice(-6),
            { id: `k-greet-${Date.now()}`, role: 'kaori', text: greeting },
          ]);
          syncMode('speaking');
        } else {
          // No greeting text — hand the turn to the user (opens the mic).
          syncMode('idle');
        }
      } catch {
        // greeting is best-effort — never block the stage; open the mic.
        syncMode('idle');
      }
    })();
  }, [isFocused, voiceReady, botId, getSessionId, beginReply, syncMode]);

  // Hands-free: when it's the user's turn — stage focused, voice pipeline up,
  // Kaori idle (not thinking/speaking), nothing being typed — open the mic
  // automatically so the user can just talk, no button press. This reopens
  // after every reply, and after the platform ends a silent session. The short
  // settle avoids grabbing the mic on a transient idle frame between her
  // sentences. The mic stays SHUT while she speaks (avoids echo into the
  // transcript); tap the mic to barge in during her turn.
  useEffect(() => {
    if (!isFocused || !voiceReady) return;
    if (listening || sending) return;
    if (modeLabel !== 'idle') return;
    if (input.trim()) return;
    const timer = setTimeout(() => {
      handsFreeListen.current = true;
      startVoiceInput({ handsFree: true });
    }, 500);
    return () => clearTimeout(timer);
  }, [isFocused, voiceReady, listening, sending, modeLabel, input, startVoiceInput]);

  // Silence Kaori (and stop the mic) the moment the stage loses focus —
  // navigating away or hitting back. expo-router keeps this screen mounted so
  // the useKithVoice unmount cleanup won't fire; without this her voice keeps
  // talking after you leave. Fires exactly once on the focused→blurred edge.
  const wasFocused = useRef(isFocused);
  useEffect(() => {
    if (wasFocused.current && !isFocused) {
      stop();
      stopVoiceInput();
      greetedRef.current = false; // re-greet next time the stage is opened
    }
    wasFocused.current = isFocused;
  }, [isFocused, stop, stopVoiceInput]);

  const lastMessages = messages.slice(-2);

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* The stage is always dark regardless of theme — keep status icons light */}
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable hitSlop={8} onPress={() => router.back()} style={styles.backButton}>
            <Ionicons color="#ffffff" name="chevron-back" size={24} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>{name || 'Kaori'}</Text>
            <Text style={styles.subtitle}>3D Companion</Text>
          </View>
          <View style={styles.statePill}>
            <View
              style={[
                styles.stateDot,
                modeLabel !== 'idle' && { backgroundColor: brandColors.primary },
              ]}
            />
            <Text style={styles.stateText}>{MODE_LABELS[modeLabel] ?? modeLabel}</Text>
          </View>
        </View>

        {/* Stage — NEVER wrapped in KeyboardAvoidingView: resizing the
            expo-gl surface on every keyboard toggle churns the GL context.
            The input bar floats over it instead. */}
        <View style={styles.stage}>
          <KaoriStage active={isFocused} demoState={demoState} voiceState={voiceState} />

          {/* Recent messages overlay */}
          <View pointerEvents="none" style={styles.messagesOverlay}>
            {lastMessages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.messageUser : styles.messageKaori,
                ]}
              >
                <Text
                  numberOfLines={4}
                  style={[
                    styles.messageText,
                    message.role === 'user' && { color: brandColors.primaryText },
                  ]}
                >
                  {message.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Input bar — iOS: 'position' slides it up over the fixed-size
            stage; Android: the OS adjustResize handles it natively. */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
          <View style={styles.inputRow}>
            <Pressable
              onPress={handleMicPress}
              style={[styles.micButton, listening && styles.micButtonLive]}
            >
              <Ionicons
                color={listening ? brandColors.primaryText : '#ffffff'}
                name={listening ? 'mic' : 'mic-outline'}
                size={20}
              />
            </Pressable>
            <TextInput
              editable={!sending}
              maxLength={500}
              onChangeText={setInput}
              onSubmitEditing={() => sendMessage(input)}
              placeholder={
                listening ? 'Listening…' : voiceReady ? 'Talk to Kaori…' : 'Message Kaori…'
              }
              placeholderTextColor="#9aa3b5"
              returnKeyType="send"
              style={styles.textInput}
              value={input}
            />
            <Pressable
              disabled={!input.trim() || sending}
              onPress={() => sendMessage(input)}
              style={[styles.sendButton, (!input.trim() || sending) && { opacity: 0.4 }]}
            >
              <Ionicons color={brandColors.primaryText} name="arrow-up" size={18} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#0b0e17',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: brandColors.primary,
    fontSize: 12,
    marginTop: 1,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(24, 28, 38, 0.9)',
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4a5568',
  },
  stateText: {
    color: '#9aa3b5',
    fontSize: 11,
  },
  stage: {
    flex: 1,
  },
  messagesOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    gap: 6,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  messageUser: {
    alignSelf: 'flex-end',
    // Translucent brand yellow — the stage shows through
    backgroundColor: 'rgba(252, 241, 80, 0.5)',
  },
  messageKaori: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(24, 28, 38, 0.45)',
  },
  messageText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 19,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#10141f',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  micButtonLive: {
    backgroundColor: brandColors.primary,
  },
  textInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    color: '#ffffff',
    fontSize: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandColors.primary,
  },
});
