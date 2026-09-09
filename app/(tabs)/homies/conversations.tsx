/**
 * Conversations (DM inbox)
 * Primary messages + a Requests tab for message requests from non-homies.
 * Renders 1:1 and group threads; updates live over the messaging socket.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMessageSocket } from '@/hooks/useMessageSocket';
import {
  type Conversation,
  getConversations,
  getConversationTitle,
  getMessageRequests,
  getUnreadFor,
} from '@/lib/api/messages';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

type Tab = 'primary' | 'requests';

export default function ConversationsScreen() {
  const { theme } = useThemeContext();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<Tab>('primary');
  const [primary, setPrimary] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const [active, reqs] = await Promise.all([getConversations('active'), getMessageRequests()]);
    setPrimary(active);
    setRequests(reqs);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  // Live: any new message / read receipt reshuffles the inbox — refetch.
  useMessageSocket({
    onNewMessage: () => fetchAll(),
    onMessagesRead: () => fetchAll(),
    onConversationUpdated: () => fetchAll(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const data = tab === 'primary' ? primary : requests;

  const renderItem = ({ item }: { item: Conversation }) => {
    const title = getConversationTitle(item);
    const unread = getUnreadFor(item, user?._id);
    const avatarUri = item.isGroup ? null : item.otherUser?.imageUri;

    return (
      <Pressable
        style={[styles.card, { backgroundColor: theme.surface }]}
        onPress={() => router.push(`/(tabs)/homies/chat/${item._id}`)}
      >
        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: theme.surfaceElevated || theme.border },
              ]}
            >
              <Ionicons
                name={item.isGroup ? 'people' : 'person'}
                size={24}
                color={theme.textSecondary}
              />
            </View>
          )}
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <View style={styles.rowHeader}>
            <Text
              style={[styles.name, { color: theme.text }, unread > 0 && styles.bold]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {item.lastMessage && (
              <Text style={[styles.time, { color: theme.textSecondary }]}>
                {formatTime(item.lastMessage.createdAt)}
              </Text>
            )}
          </View>
          {item.lastMessage ? (
            <Text
              style={[styles.last, { color: theme.textSecondary }, unread > 0 && styles.bold]}
              numberOfLines={1}
            >
              {item.lastMessage.senderId === user?._id ? 'You: ' : ''}
              {item.lastMessage.content}
            </Text>
          ) : (
            <Text style={[styles.last, { color: theme.textSecondary }]} numberOfLines={1}>
              {tab === 'requests' ? 'wants to message you' : 'Say hey 👋'}
            </Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={[styles.iconButton, { backgroundColor: theme.surface }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Messages</Text>
        <Pressable
          style={[styles.iconButton, { backgroundColor: theme.surface }]}
          onPress={() => router.push('/(tabs)/homies/new-chat')}
        >
          <Ionicons name="create-outline" size={22} color={theme.text} />
        </Pressable>
      </View>

      {/* Primary / Requests toggle */}
      <View style={[styles.tabs, { backgroundColor: theme.surface }]}>
        {(['primary', 'requests'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && { backgroundColor: YELLOW }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? DARK : theme.textSecondary }]}>
              {t === 'primary' ? 'Messages' : 'Requests'}
              {t === 'requests' && requests.length > 0 ? ` (${requests.length})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={tab === 'requests' ? 'mail-outline' : 'chatbubbles-outline'}
                size={64}
                color={theme.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {tab === 'requests' ? 'No requests' : 'No messages yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {tab === 'requests'
                  ? 'Messages from riders who aren’t your homies show up here'
                  : 'Tap the compose button to start a chat'}
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  separator: { height: 8 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: 20 },
  emptySubtitle: { fontSize: 15, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14 },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: DARK },
  info: { flex: 1, marginRight: 8 },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  time: { fontSize: 12 },
  last: { fontSize: 14 },
  bold: { fontWeight: '700' },
});
