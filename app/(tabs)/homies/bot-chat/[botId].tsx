/**
 * Bot Chat Screen
 * Chat with AI companion bots (e.g. Kaori)
 * Uses /api/bot-chat endpoints instead of regular DM
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RichContentCard } from '@/components/chat/RichContentCards';
import { apiClient } from '@/lib/api/client';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

interface Bot {
  _id: string;
  name: string;
  bio?: string;
  imageUri?: string;
  botCharacter?: string;
}

interface BotMessage {
  _id: string;
  fromUserId: string;
  toUserId: string;
  message?: string;
  type: 'user' | 'bot';
  richContent?: {
    type: string;
    data: any;
  };
  createdAt: string;
  // Client-only greeting shown on open — never persisted to history.
  _ephemeral?: boolean;
}

export default function BotChatScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const { theme, colors } = useThemeContext();
  const { user } = useAuthStore();

  const [bot, setBot] = useState<Bot | null>(null);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const userId = user?.id || (user as any)?._id;

  // Fetch bot info and chat history
  const fetchData = useCallback(async () => {
    if (!botId) return;
    try {
      const [bots, history] = await Promise.all([
        apiClient.get<Bot[]>('/bot-chat/bots').catch(() => []),
        apiClient.get<BotMessage[]>(`/bot-chat/history/${botId}`).catch(() => []),
      ]);

      const botInfo = (Array.isArray(bots) ? bots : []).find((b) => b._id === botId);
      if (botInfo) setBot(botInfo);

      // History comes in chronological order, reverse for inverted FlatList
      const msgs = Array.isArray(history) ? history : [];
      setMessages(msgs.reverse());
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Greet on open: each time the screen gains focus (and once we know it's
  // Kaori), fetch a fresh homie greeting and show it as an EPHEMERAL bubble —
  // it is never saved to history. Any prior ephemeral greeting is stripped so
  // they don't stack.
  const isKaori = ((bot?.botCharacter ?? bot?.name ?? '') as string)
    .toLowerCase()
    .includes('kaori');

  useFocusEffect(
    useCallback(() => {
      if (!botId || !isKaori) return;
      let cancelled = false;
      (async () => {
        try {
          const res = await apiClient.post<{ greeting?: string }>(
            `/companion/profile/${botId}/greeting`,
            {},
          );
          if (cancelled || !res?.greeting) return;
          const greetingMsg: BotMessage = {
            _id: `greeting-${Date.now()}`,
            fromUserId: botId,
            toUserId: userId || '',
            message: res.greeting,
            type: 'bot',
            createdAt: new Date().toISOString(),
            _ephemeral: true,
          };
          setMessages((prev) => [greetingMsg, ...prev.filter((m) => !m._ephemeral)]);
        } catch {
          // greeting is best-effort — never block the chat
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [botId, isKaori, userId]),
  );

  // Send message
  const handleSend = async () => {
    if (!inputText.trim() || !botId || sending) return;

    const messageContent = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistically add user message
    const tempUserMsg: BotMessage = {
      _id: `temp-${Date.now()}`,
      fromUserId: userId || '',
      toUserId: botId,
      message: messageContent,
      type: 'user',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [tempUserMsg, ...prev]);

    try {
      const response = await apiClient.post<{
        userMessage: BotMessage;
        botMessage: BotMessage;
      }>('/bot-chat/message', { botId, message: messageContent });

      if (response) {
        // Replace temp message with real ones
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m._id !== tempUserMsg._id);
          return [response.botMessage, response.userMessage, ...withoutTemp];
        });
      }
    } catch (_error) {
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m._id !== tempUserMsg._id));
      setInputText(messageContent);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.userInfo}>
          <View style={styles.avatarWrapper}>
            {bot?.imageUri ? (
              <Image source={{ uri: bot.imageUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: `${YELLOW}30` }]}>
                <Text style={styles.avatarEmoji}>🤖</Text>
              </View>
            )}
            <View style={[styles.botBadge, { borderColor: theme.background }]}>
              <Ionicons name="hardware-chip-outline" size={8} color={DARK} />
            </View>
          </View>
          <View style={styles.userText}>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
              {bot?.name || 'Companion'}
            </Text>
            <Text style={[styles.userStatus, { color: theme.textSecondary }]}>AI Companion</Text>
          </View>
        </View>

        {/* 3D stage only exists for Kaori so far — gate the affordance */}
        {botId && (bot?.botCharacter ?? bot?.name ?? '').toLowerCase().includes('kaori') ? (
          <Pressable
            style={styles.menuButton}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/homies/companion-stage/[botId]',
                params: { botId, name: bot?.name ?? 'Kaori' },
              })
            }
          >
            <Ionicons name="cube-outline" size={22} color={theme.text} />
          </Pressable>
        ) : (
          <View style={styles.menuButton} />
        )}
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          inverted
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {bot?.name ? `Say hello to ${bot.name}!` : 'No messages yet. Say hello!'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.type === 'user';

            return (
              <>
                <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
                  <View
                    style={[
                      styles.messageBubble,
                      isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                      { backgroundColor: isMe ? colors.primary : theme.surface },
                    ]}
                  >
                    {item.message ? (
                      <Text style={[styles.messageText, { color: isMe ? DARK : theme.text }]}>
                        {item.message}
                      </Text>
                    ) : (
                      // Legacy rows from before the backend persisted user
                      // message text (fixed May 2026) have no message field.
                      <Text
                        style={[
                          styles.messageText,
                          styles.messageMissing,
                          { color: isMe ? DARK : theme.textTertiary },
                        ]}
                      >
                        message not saved
                      </Text>
                    )}
                  </View>
                  <View style={styles.messageFooter}>
                    <Text style={[styles.timeText, { color: theme.textTertiary }]}>
                      {formatTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
                {/* Rich content card from bot messages */}
                {item.richContent && (
                  <View style={[styles.messageRow, { marginTop: -4 }]}>
                    <RichContentCard richContent={item.richContent as any} />
                  </View>
                )}
              </>
            );
          }}
        />

        {/* Typing indicator when sending */}
        {sending && (
          <View style={[styles.typingContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.typingBubble, { backgroundColor: theme.surface }]}>
              <View style={styles.typingDots}>
                <View style={[styles.typingDot, styles.typingDot1]} />
                <View style={[styles.typingDot, styles.typingDot2]} />
                <View style={[styles.typingDot, styles.typingDot3]} />
              </View>
            </View>
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputContainer, { borderTopColor: theme.border }]}>
          <View style={[styles.inputWrapper, { backgroundColor: theme.surface }]}>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Message..."
              placeholderTextColor={theme.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              editable={!sending}
            />
          </View>

          <Pressable
            style={[
              styles.sendButton,
              { backgroundColor: inputText.trim() ? colors.primary : theme.surface },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={DARK} />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={inputText.trim() ? DARK : theme.textSecondary}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  botBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: YELLOW,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userText: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userStatus: {
    fontSize: 12,
    marginTop: 1,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingTop: 8,
  },
  emptyMessages: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    fontSize: 15,
  },
  messageRow: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  messageRowMe: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  messageBubbleMe: {
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageMissing: {
    fontStyle: 'italic',
    opacity: 0.6,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  timeText: {
    fontSize: 11,
  },
  // Typing indicator
  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingBubble: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
