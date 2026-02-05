/**
 * Conversations Screen
 * List of all direct message conversations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import { getConversations, Conversation } from '@/lib/api/messages';

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

// Sport emojis mapping
const SPORT_EMOJIS: Record<string, string> = {
  skateboarding: '🛹',
  snowboarding: '🏂',
  skiing: '⛷️',
  bmx: '🚲',
  mtb: '🚵',
  scooter: '🛴',
  rollerblading: '🛼',
  surfing: '🏄',
  wakeboarding: '🏄',
};

export default function ConversationsScreen() {
  const { theme, colors } = useThemeContext();
  const { user } = useAuthStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [fetchConversations]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getOtherUser = (conversation: Conversation) => {
    // Use precomputed otherUser if available
    if (conversation.otherUser) {
      return conversation.otherUser;
    }
    // Find in participantDetails
    if (conversation.participantDetails) {
      return conversation.participantDetails.find(p => p._id !== user?._id);
    }
    return null;
  };

  const getUnreadCount = (conversation: Conversation) => {
    if (conversation.unreadCount && user?._id) {
      return conversation.unreadCount[user._id] || 0;
    }
    return 0;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.surface }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Messages</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No messages yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Start a conversation with a homie
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const otherUser = getOtherUser(item);
            const unreadCount = getUnreadCount(item);
            const sportEmoji = '🛹'; // Default for now

            return (
              <Pressable
                style={[styles.conversationCard, { backgroundColor: theme.surface }]}
                onPress={() => router.push(`/(tabs)/homies/chat/${item._id}`)}
              >
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  {otherUser?.imageUri ? (
                    <Image source={{ uri: otherUser.imageUri }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: theme.surfaceElevated || theme.border }]}>
                      <Text style={styles.avatarEmoji}>{sportEmoji}</Text>
                    </View>
                  )}
                  {unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Content */}
                <View style={styles.conversationInfo}>
                  <View style={styles.conversationHeader}>
                    <Text
                      style={[
                        styles.conversationName,
                        { color: theme.text },
                        unreadCount > 0 && styles.unreadText,
                      ]}
                      numberOfLines={1}
                    >
                      {otherUser?.name || 'Unknown User'}
                    </Text>
                    {item.lastMessage && (
                      <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                        {formatTime(item.lastMessage.createdAt)}
                      </Text>
                    )}
                  </View>
                  {item.lastMessage && (
                    <Text
                      style={[
                        styles.lastMessage,
                        { color: theme.textSecondary },
                        unreadCount > 0 && styles.unreadText,
                      ]}
                      numberOfLines={1}
                    >
                      {item.lastMessage.senderId === user?._id ? 'You: ' : ''}
                      {item.lastMessage.content}
                    </Text>
                  )}
                </View>

                {/* Chevron */}
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },

  // Conversation Card
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 26,
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
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: DARK,
  },
  conversationInfo: {
    flex: 1,
    marginRight: 8,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
  },
  lastMessage: {
    fontSize: 14,
  },
  unreadText: {
    fontWeight: '700',
  },
});
