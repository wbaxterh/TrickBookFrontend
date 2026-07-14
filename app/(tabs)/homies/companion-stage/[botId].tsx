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
 * WHICH 360 does this text name? Identification only — no demo-intent gate, so
 * it also works on Kaori's own reply ("...watch this backside 360...").
 * Backside spins the other way; plain "360" / "frontside 360" stays frontside.
 */
function detectTrickId(text: string): TrickId | null {
  // Flips first — a wildcat/tamedog is a flip, not a 360 ("backflip" contains "back").
  if (/\b(wildcat|back[\s-]?flip)\b/i.test(text)) return 'wildcat';
  if (/\b(tamedog|tame[\s-]?dog|front[\s-]?flip)\b/i.test(text)) return 'tamedog';
  const mentions360 = /\b(360|three[\s-]?sixty|(front|back)side\s*3|(fs|bs)\s*3|back\s*3)\b/i.test(
    text,
  );
  if (!mentions360) return null;
  const isBackside = /\b(backside|bs)\s*(360|three[\s-]?sixty|3)\b|\bback\s*3\b/i.test(text);
  return isBackside ? 'backside-360' : 'frontside-360';
}

/**
 * Detect "show me a trick" intents so Kaori demonstrates with her body while
 * she explains. Intent verb + a named trick → that trick.
 */
function detectTrickDemo(text: string): TrickId | null {
  const wantsDemo = /\b(show|demo|demonstrate|do|see|watch|hit|throw|bust|try|land)\b/i.test(text);
  return wantsDemo ? detectTrickId(text) : null;
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
  if (
    /\b(wildcat|tamedog|tame[\s-]?dog|back[\s-]?flip|front[\s-]?flip|flip|invert|somersault)\b/i.test(
      sentence,
    )
  ) {
    return 'full';
  }
  if (/\b(spin|rotat\w*|360|three[\s-]?sixty)\b/i.test(sentence)) return 'full';
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
        const requestedTrick = detectTrickDemo(text);
        const wantsDemo =
          reply && (requestedTrick !== null || /watch this|let me show/i.test(reply));
        if (wantsDemo) {
          // ALWAYS resolve the trick — the user's explicit ask first, else what
          // her reply names, else keep the current one. Never fall through to a
          // stale/default frontside when the user asked for a backside.
          const trick = requestedTrick ?? detectTrickId(reply) ?? demoState.current.trick;
          demoState.current.trick = trick;
          if (__DEV__) console.log('[stage] demo trick:', trick);
          demoState.current.session = true;
          demoState.current.idleT = 0;
          replySentences.current = splitSentences(reply);
          if (!sessionId) {
            // Voiceless fallback: no sentence cues will arrive — run the
            // full trick once, then step off the board.
            startAction(demoState.current, 'full');
            setTimeout(() => {
              demoState.current.session = false;
              replySentences.current = null;
            }, 7000);
          }
        }
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

  const { listening, toggleVoiceInput } = useVoiceInput({
    onTranscript: setInput,
    onSubmit: (text) => {
      sendMessage(text);
    },
    onListeningChange: (isListening) => {
      if (isListening) {
        syncMode('listening');
      } else {
        // Speech recognition leaves the audio session in record mode —
        // restore playback so the reply's TTS isn't attenuated.
        reassertPlayback();
        if (voiceState.current.mode === 'listening') syncMode('idle');
      }
    },
  });

  const handleMicPress = useCallback(() => {
    // Silence Kaori BEFORE the mic opens — otherwise her speaker output
    // bleeds into the head of the transcript.
    if (!listening) bargeIn();
    toggleVoiceInput();
  }, [listening, bargeIn, toggleVoiceInput]);

  // Silence Kaori (and stop the mic) the moment the stage loses focus —
  // navigating away or hitting back. expo-router keeps this screen mounted so
  // the useKithVoice unmount cleanup won't fire; without this her voice keeps
  // talking after you leave. Fires exactly once on the focused→blurred edge.
  const wasFocused = useRef(isFocused);
  useEffect(() => {
    if (wasFocused.current && !isFocused) {
      stop();
      if (listening) toggleVoiceInput();
    }
    wasFocused.current = isFocused;
  }, [isFocused, stop, listening, toggleVoiceInput]);

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
