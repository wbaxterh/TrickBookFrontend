/**
 * Chat Screen
 * Real-time messaging with a homie
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RichContentCard } from '@/components/chat/RichContentCards';
import { useMessageSocket } from '@/hooks/useMessageSocket';
import { getMyHomies, type Homie } from '@/lib/api/homies';
import {
  acceptMessageRequest,
  addGroupMembers,
  type Conversation,
  declineMessageRequest,
  getConversation,
  getMessages,
  type Message,
  markAsRead,
  type Participant,
  renameGroup,
  type SharedContent,
  sendMessage as sendMessageApi,
} from '@/lib/api/messages';
import { setCurrentConversationId } from '@/lib/notifications';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { emitTyping } from '@/lib/realtime/socket';
import { useAuthStore } from '@/lib/stores/authStore';

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

// Shared Content Bubble Component
function SharedContentBubble({
  sharedContent,
  isMe,
  theme,
  colors,
}: {
  sharedContent: SharedContent;
  isMe: boolean;
  theme: any;
  colors: any;
}) {
  const getIcon = () => {
    switch (sharedContent.contentType) {
      case 'tricklist':
        return 'list';
      case 'trick':
        return 'sparkles';
      case 'spot':
        return 'location';
      case 'spotlist':
        return 'bookmark';
      case 'video':
        return 'videocam';
      default:
        return 'share';
    }
  };

  const getTypeLabel = () => {
    switch (sharedContent.contentType) {
      case 'tricklist':
        return 'TrickList';
      case 'trick':
        return 'Trick';
      case 'spot':
        return 'Spot';
      case 'spotlist':
        return 'SpotList';
      case 'video':
        return 'Video';
      default:
        return 'Shared';
    }
  };

  const handlePress = () => {
    // Navigate to the appropriate screen based on content type
    switch (sharedContent.contentType) {
      case 'tricklist':
        router.push(`/(tabs)/trickbook/list/${sharedContent.contentId}`);
        break;
      case 'trick':
        // Trick detail would need the list context, for now just open trickbook
        router.push('/(tabs)/trickbook');
        break;
      case 'spot':
        router.push(`/(tabs)/spots/${sharedContent.contentId}`);
        break;
      case 'spotlist':
        router.push(`/(tabs)/spots/list/${sharedContent.contentId}`);
        break;
      case 'video':
        router.push(`/(tabs)/media/post/${sharedContent.contentId}`);
        break;
    }
  };

  return (
    <Pressable
      style={[
        styles.sharedContentBubble,
        { backgroundColor: isMe ? colors.primary : theme.surface },
      ]}
      onPress={handlePress}
    >
      <View style={styles.sharedContentHeader}>
        <View
          style={[
            styles.sharedContentIcon,
            { backgroundColor: isMe ? 'rgba(0,0,0,0.15)' : `${colors.primary}20` },
          ]}
        >
          <Ionicons name={getIcon() as any} size={18} color={isMe ? DARK : colors.primary} />
        </View>
        <Text
          style={[
            styles.sharedContentType,
            { color: isMe ? 'rgba(0,0,0,0.6)' : theme.textSecondary },
          ]}
        >
          {getTypeLabel()}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={isMe ? 'rgba(0,0,0,0.4)' : theme.textSecondary}
        />
      </View>
      {sharedContent.preview && (
        <View style={styles.sharedContentPreview}>
          {sharedContent.preview.thumbnailUrl && (
            <Image
              source={{ uri: sharedContent.preview.thumbnailUrl }}
              style={styles.sharedContentThumbnail}
            />
          )}
          <View style={styles.sharedContentInfo}>
            <Text
              style={[styles.sharedContentTitle, { color: isMe ? DARK : theme.text }]}
              numberOfLines={2}
            >
              {sharedContent.preview.title}
            </Text>
            {sharedContent.preview.subtitle && (
              <Text
                style={[
                  styles.sharedContentSubtitle,
                  { color: isMe ? 'rgba(0,0,0,0.6)' : theme.textSecondary },
                ]}
                numberOfLines={1}
              >
                {sharedContent.preview.subtitle}
              </Text>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { theme, colors } = useThemeContext();
  const { user } = useAuthStore();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const [processingRequest, setProcessingRequest] = useState(false);
  // Group management sheet (three-dots): menu → rename | add people
  const [sheetMode, setSheetMode] = useState<null | 'menu' | 'rename' | 'add'>(null);
  const [renameValue, setRenameValue] = useState('');
  const [addHomies, setAddHomies] = useState<Homie[]>([]);
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());
  const [sheetBusy, setSheetBusy] = useState(false);

  // Get user ID (handles both id and _id)
  const userId = user?.id || user?._id;

  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch conversation and messages
  const fetchData = useCallback(
    async (isRefresh: boolean = false) => {
      if (!conversationId) return;

      try {
        const [convoData, messagesData] = await Promise.all([
          getConversation(conversationId),
          getMessages(conversationId, { page: 1, limit: 50 }),
        ]);

        setConversation(convoData);
        // Reverse messages so newest is first (inverted FlatList shows first item at bottom)
        const msgs = messagesData.messages || [];
        setMessages(msgs.reverse());
        setHasMore(messagesData.pagination?.hasMore || false);
        setPage(1);

        // Mark as read
        await markAsRead(conversationId);
      } catch (_error) {
      } finally {
        setLoading(false);
        if (isRefresh) setRefreshing(false);
      }
    },
    [conversationId],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  // Mark as read when screen is focused + tell the notification handler we're
  // viewing this chat so it can suppress banners for incoming messages here.
  useFocusEffect(
    useCallback(() => {
      if (conversationId) {
        markAsRead(conversationId);
        setCurrentConversationId(conversationId);
      }
      return () => {
        setCurrentConversationId(null);
      };
    }, [conversationId]),
  );

  // Load more messages (pagination) - older messages
  const loadMoreMessages = async () => {
    if (!hasMore || !conversationId) return;

    const nextPage = page + 1;
    const messagesData = await getMessages(conversationId, { page: nextPage, limit: 50 });

    if (messagesData.messages) {
      // Reverse and append older messages at the end
      const olderMessages = messagesData.messages.reverse();
      setMessages((prev) => [...prev, ...olderMessages]);
      setPage(nextPage);
      setHasMore(messagesData.pagination?.hasMore || false);
    }
  };

  // Get the other user in the conversation
  const getOtherUser = (): Participant | undefined => {
    if (conversation?.otherUser) {
      return conversation.otherUser;
    }
    if (conversation?.participantDetails) {
      return conversation.participantDetails.find((p) => p._id !== userId);
    }
    return undefined;
  };

  const otherUser = getOtherUser();

  // Group + message-request derived state
  const isGroup = !!conversation?.isGroup;
  const participantMap = useMemo(() => {
    const map: Record<string, Participant> = {};
    (conversation?.participantDetails || []).forEach((p) => {
      map[p._id] = p;
    });
    return map;
  }, [conversation?.participantDetails]);
  const isPendingRequestForMe =
    !!conversation?.isRequest && !!conversation?.requestedBy && conversation.requestedBy !== userId;
  const isMyOutgoingRequest = !!conversation?.isRequest && conversation?.requestedBy === userId;

  const headerTitle = isGroup
    ? conversation?.groupName || 'Group'
    : otherUser?.name || 'Unknown User';
  const typingNames = [...typingUserIds]
    .map((id) => participantMap[id]?.name || (isGroup ? 'Someone' : otherUser?.name))
    .filter(Boolean) as string[];
  const headerSubtitle =
    typingNames.length > 0
      ? isGroup
        ? `${typingNames.join(', ')} typing…`
        : 'typing…'
      : isGroup
        ? `${conversation?.participants.length || 0} members`
        : undefined;

  // Live updates for this open thread (append messages, read receipts, typing).
  useMessageSocket({
    conversationId,
    onNewMessage: ({ message }) => {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [message, ...prev]));
      if (message.senderId !== userId && conversationId) markAsRead(conversationId);
    },
    onMessagesRead: ({ conversationId: cid }) => {
      if (cid !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) => (m.senderId === userId ? { ...m, status: 'read' as const } : m)),
      );
    },
    onTyping: ({ conversationId: cid, userId: uid, typing }) => {
      if (cid !== conversationId || uid === userId) return;
      setTypingUserIds((prev) => {
        const next = new Set(prev);
        if (typing) next.add(uid);
        else next.delete(uid);
        return next;
      });
    },
    onConversationUpdated: ({ conversationId: cid }) => {
      if (cid !== conversationId) return;
      getConversation(conversationId).then((c) => c && setConversation(c));
    },
  });

  const handleAcceptRequest = async () => {
    if (!conversationId) return;
    setProcessingRequest(true);
    const ok = await acceptMessageRequest(conversationId);
    setProcessingRequest(false);
    if (ok) setConversation((prev) => (prev ? { ...prev, isRequest: false } : prev));
  };

  const handleDeclineRequest = async () => {
    if (!conversationId) return;
    setProcessingRequest(true);
    const ok = await declineMessageRequest(conversationId);
    if (ok) router.back();
    else setProcessingRequest(false);
  };

  // --- Group management (three-dots) ---
  const openRename = () => {
    setRenameValue(conversation?.groupName || '');
    setSheetMode('rename');
  };

  const openAddPeople = async () => {
    setAddSelected(new Set());
    setSheetMode('add');
    const homies = await getMyHomies();
    const current = new Set(conversation?.participants || []);
    setAddHomies(homies.filter((h) => !current.has(h._id)));
  };

  const submitRename = async () => {
    const name = renameValue.trim();
    if (!name || !conversationId) return;
    setSheetBusy(true);
    const ok = await renameGroup(conversationId, name);
    setSheetBusy(false);
    if (ok) {
      setConversation((prev) => (prev ? { ...prev, groupName: name } : prev));
      setSheetMode(null);
    }
  };

  const toggleAdd = (id: string) => {
    setAddSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitAddPeople = async () => {
    if (addSelected.size === 0 || !conversationId) return;
    setSheetBusy(true);
    const updated = await addGroupMembers(conversationId, [...addSelected]);
    setSheetBusy(false);
    if (updated) {
      setConversation(updated);
      setSheetMode(null);
    }
  };

  // Emit typing while the user composes; auto-stop after a short pause.
  const handleInputChange = (text: string) => {
    setInputText(text);
    if (!conversationId) return;
    emitTyping(conversationId, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(conversationId, false), 2000);
  };

  // Send message
  const handleSendMessage = async () => {
    if (!inputText.trim() || !conversationId || sending) return;

    const messageContent = inputText.trim();
    setInputText('');
    setSending(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    emitTyping(conversationId, false);

    try {
      const newMessage = await sendMessageApi(conversationId, messageContent);
      if (newMessage) {
        // Add to beginning since list is inverted (dedupe vs the socket echo)
        setMessages((prev) =>
          prev.some((m) => m._id === newMessage._id) ? prev : [newMessage, ...prev],
        );

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);
      }
    } catch (_error) {
      // Restore input on error
      setInputText(messageContent);
    } finally {
      setSending(false);
    }
  };

  // Format message time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format date for day separators
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Check if we should show a date separator
  const shouldShowDateSeparator = (currentMsg: Message, prevMsg?: Message) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return currentDate !== prevDate;
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

        <Pressable
          style={styles.userInfo}
          disabled={isGroup}
          onPress={() => !isGroup && otherUser && router.push(`/(tabs)/homies/${otherUser._id}`)}
        >
          {isGroup ? (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Ionicons name="people" size={20} color={DARK} />
            </View>
          ) : otherUser?.imageUri ? (
            <Image source={{ uri: otherUser.imageUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarEmoji}>🛹</Text>
            </View>
          )}
          <View style={styles.userText}>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
              {headerTitle}
            </Text>
            {headerSubtitle && (
              <Text style={[styles.userSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                {headerSubtitle}
              </Text>
            )}
          </View>
        </Pressable>

        <Pressable
          style={styles.menuButton}
          onPress={() => isGroup && setSheetMode('menu')}
          disabled={!isGroup}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={20}
            color={isGroup ? theme.text : 'transparent'}
          />
        </Pressable>
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
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />
          }
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No messages yet. Say hello!
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isMe = item.senderId === userId;
            const prevMessage = messages[index + 1];
            const showDate = shouldShowDateSeparator(item, prevMessage);

            const isSharedContent = item.type === 'shared' && item.sharedContent;

            return (
              <>
                <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
                  {isGroup && !isMe && (
                    <Text style={[styles.senderName, { color: theme.textSecondary }]}>
                      {participantMap[item.senderId]?.name || 'Rider'}
                    </Text>
                  )}
                  {isSharedContent ? (
                    // Render shared content bubble
                    <SharedContentBubble
                      sharedContent={item.sharedContent!}
                      isMe={isMe}
                      theme={theme}
                      colors={colors}
                    />
                  ) : (
                    // Render regular text message
                    <View
                      style={[
                        styles.messageBubble,
                        isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                        { backgroundColor: isMe ? colors.primary : theme.surface },
                      ]}
                    >
                      <Text style={[styles.messageText, { color: isMe ? DARK : theme.text }]}>
                        {item.content}
                      </Text>
                    </View>
                  )}
                  <View style={styles.messageFooter}>
                    <Text style={[styles.timeText, { color: theme.textTertiary }]}>
                      {formatTime(item.createdAt)}
                    </Text>
                    {isMe && item.status === 'read' && (
                      <Ionicons
                        name="checkmark-done"
                        size={14}
                        color={colors.primary}
                        style={styles.readIcon}
                      />
                    )}
                  </View>
                </View>
                {/* Show text message below shared content if both exist */}
                {isSharedContent && item.content && (
                  <View style={[styles.messageRow, isMe && styles.messageRowMe, { marginTop: -8 }]}>
                    <View
                      style={[
                        styles.messageBubble,
                        isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                        { backgroundColor: isMe ? colors.primary : theme.surface },
                      ]}
                    >
                      <Text style={[styles.messageText, { color: isMe ? DARK : theme.text }]}>
                        {item.content}
                      </Text>
                    </View>
                  </View>
                )}
                {/* Rich content card from bot messages */}
                {item.richContent && (
                  <View style={[styles.messageRow, { marginTop: -4 }]}>
                    <RichContentCard richContent={item.richContent} />
                  </View>
                )}
                {showDate && (
                  <View style={styles.dateSeparator}>
                    <View style={[styles.dateLine, { backgroundColor: theme.border }]} />
                    <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                      {formatDate(item.createdAt)}
                    </Text>
                    <View style={[styles.dateLine, { backgroundColor: theme.border }]} />
                  </View>
                )}
              </>
            );
          }}
        />

        {/* Message request banner (received) */}
        {isPendingRequestForMe && (
          <View
            style={[
              styles.requestBanner,
              { backgroundColor: theme.surface, borderTopColor: theme.border },
            ]}
          >
            <Text style={[styles.requestText, { color: theme.textSecondary }]} numberOfLines={2}>
              {headerTitle} wants to message you. Accept to reply.
            </Text>
            <View style={styles.requestActions}>
              <Pressable
                style={[styles.requestBtn, styles.declineBtn, { borderColor: theme.border }]}
                onPress={handleDeclineRequest}
                disabled={processingRequest}
              >
                <Text style={[styles.requestBtnText, { color: theme.text }]}>Decline</Text>
              </Pressable>
              <Pressable
                style={[styles.requestBtn, { backgroundColor: colors.primary }]}
                onPress={handleAcceptRequest}
                disabled={processingRequest}
              >
                <Text style={[styles.requestBtnText, { color: DARK }]}>Accept</Text>
              </Pressable>
            </View>
          </View>
        )}
        {isMyOutgoingRequest && (
          <View style={[styles.pendingNote, { borderTopColor: theme.border }]}>
            <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.pendingText, { color: theme.textSecondary }]} numberOfLines={1}>
              Request sent — they’ll see this once they accept
            </Text>
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
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
            />
          </View>

          <Pressable
            style={[
              styles.sendButton,
              { backgroundColor: inputText.trim() ? colors.primary : theme.surface },
            ]}
            onPress={handleSendMessage}
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

      {/* Group management sheet (three-dots) */}
      <Modal
        visible={sheetMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetMode(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetMode(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />

            {sheetMode === 'menu' && (
              <>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>{headerTitle}</Text>
                <Pressable style={styles.sheetRow} onPress={openAddPeople}>
                  <Ionicons name="person-add-outline" size={22} color={theme.text} />
                  <Text style={[styles.sheetRowText, { color: theme.text }]}>Add people</Text>
                </Pressable>
                <Pressable style={styles.sheetRow} onPress={openRename}>
                  <Ionicons name="create-outline" size={22} color={theme.text} />
                  <Text style={[styles.sheetRowText, { color: theme.text }]}>Rename group</Text>
                </Pressable>
              </>
            )}

            {sheetMode === 'rename' && (
              <>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Rename group</Text>
                <TextInput
                  style={[
                    styles.sheetInput,
                    {
                      color: theme.text,
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                    },
                  ]}
                  value={renameValue}
                  onChangeText={setRenameValue}
                  placeholder="Group name"
                  placeholderTextColor={theme.textSecondary}
                  maxLength={40}
                  autoFocus
                />
                <Pressable
                  style={[
                    styles.sheetPrimary,
                    { backgroundColor: colors.primary },
                    (!renameValue.trim() || sheetBusy) && { opacity: 0.5 },
                  ]}
                  onPress={submitRename}
                  disabled={!renameValue.trim() || sheetBusy}
                >
                  {sheetBusy ? (
                    <ActivityIndicator color={DARK} />
                  ) : (
                    <Text style={styles.sheetPrimaryText}>Save</Text>
                  )}
                </Pressable>
              </>
            )}

            {sheetMode === 'add' && (
              <>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Add people</Text>
                <FlatList
                  data={addHomies}
                  keyExtractor={(item) => item._id}
                  style={styles.sheetList}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <Text style={[styles.sheetEmpty, { color: theme.textSecondary }]}>
                      All your homies are already here
                    </Text>
                  }
                  renderItem={({ item }) => {
                    const sel = addSelected.has(item._id);
                    return (
                      <Pressable style={styles.sheetPersonRow} onPress={() => toggleAdd(item._id)}>
                        {item.imageUri ? (
                          <Image source={{ uri: item.imageUri }} style={styles.sheetAvatar} />
                        ) : (
                          <View
                            style={[
                              styles.sheetAvatar,
                              styles.sheetAvatarPh,
                              { backgroundColor: theme.background },
                            ]}
                          >
                            <Ionicons name="person" size={18} color={theme.textSecondary} />
                          </View>
                        )}
                        <Text
                          style={[styles.sheetPersonName, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <View
                          style={[
                            styles.sheetCheck,
                            { borderColor: sel ? colors.primary : theme.border },
                            sel && { backgroundColor: colors.primary },
                          ]}
                        >
                          {sel && <Ionicons name="checkmark" size={14} color={DARK} />}
                        </View>
                      </Pressable>
                    );
                  }}
                />
                <Pressable
                  style={[
                    styles.sheetPrimary,
                    { backgroundColor: colors.primary },
                    (addSelected.size === 0 || sheetBusy) && { opacity: 0.5 },
                  ]}
                  onPress={submitAddPeople}
                  disabled={addSelected.size === 0 || sheetBusy}
                >
                  {sheetBusy ? (
                    <ActivityIndicator color={DARK} />
                  ) : (
                    <Text style={styles.sheetPrimaryText}>
                      Add{addSelected.size > 0 ? ` (${addSelected.size})` : ''}
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  userText: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
    marginLeft: 4,
  },
  requestBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  requestText: {
    fontSize: 14,
    textAlign: 'center',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  requestBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineBtn: {
    borderWidth: 1,
  },
  requestBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  pendingText: {
    fontSize: 13,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 10,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  sheetRowText: {
    fontSize: 16,
    fontWeight: '500',
  },
  sheetInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  sheetPrimary: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sheetList: {
    marginBottom: 14,
  },
  sheetEmpty: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
  },
  sheetPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  sheetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sheetAvatarPh: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPersonName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  sheetCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  timeText: {
    fontSize: 11,
  },
  readIcon: {
    marginLeft: 4,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
  },
  dateText: {
    fontSize: 12,
    marginHorizontal: 12,
    fontWeight: '500',
  },
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
  // Shared Content Styles
  sharedContentBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    overflow: 'hidden',
  },
  sharedContentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sharedContentIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedContentType: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sharedContentPreview: {
    flexDirection: 'row',
    gap: 10,
  },
  sharedContentThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  sharedContentInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  sharedContentTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  sharedContentSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
