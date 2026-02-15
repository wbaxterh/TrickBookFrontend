/**
 * Homies Screen
 * My Homies list, Find Riders, Pending Requests
 *
 * Features:
 * - Tab toggle: My Homies / Find / Requests
 * - Search homies
 * - Message button on each homie
 * - Accept/Decline requests
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  acceptHomieRequest,
  getDiscoverableUsers,
  getMyHomies,
  getPendingRequests,
  type Homie,
  type HomieRequest,
  rejectHomieRequest,
  sendHomieRequest,
} from '@/lib/api/homies';
import { getOrCreateConversation } from '@/lib/api/messages';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

type TabType = 'homies' | 'find' | 'requests';

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

export default function HomiesScreen() {
  const { theme, colors, isDark } = useThemeContext();
  const { user } = useAuthStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('homies');
  const [searchQuery, setSearchQuery] = useState('');

  // Data state
  const [homies, setHomies] = useState<Homie[]>([]);
  const [discoverableUsers, setDiscoverableUsers] = useState<Homie[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<HomieRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch data based on active tab
  const fetchData = useCallback(async () => {
    try {
      if (activeTab === 'homies') {
        const data = await getMyHomies();
        setHomies(data);
      } else if (activeTab === 'find') {
        const data = await getDiscoverableUsers();
        setDiscoverableUsers(data);
      } else if (activeTab === 'requests') {
        const data = await getPendingRequests();
        setReceivedRequests(data.received || []);
        setSentRequests(data.sent || []);
      }
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Handle message button
  const handleMessage = async (homie: Homie) => {
    try {
      const conversation = await getOrCreateConversation(homie._id);
      if (conversation) {
        router.push(`/(tabs)/homies/chat/${conversation._id}`);
      } else {
        Alert.alert('Error', 'Could not start conversation');
      }
    } catch (_error) {
      Alert.alert('Error', 'Could not start conversation');
    }
  };

  // Handle send request
  const handleSendRequest = async (targetUser: Homie) => {
    const success = await sendHomieRequest(targetUser._id);
    if (success) {
      Alert.alert('Request Sent', `Homie request sent to ${targetUser.name}`);
      setSentRequests((prev) => [...prev, targetUser._id]);
    } else {
      Alert.alert('Error', 'Could not send homie request');
    }
  };

  // Handle accept request
  const handleAccept = async (request: HomieRequest) => {
    const success = await acceptHomieRequest(request.from);
    if (success) {
      setReceivedRequests((prev) => prev.filter((r) => r.from !== request.from));
      // Refresh homies list
      const newHomies = await getMyHomies();
      setHomies(newHomies);
    } else {
      Alert.alert('Error', 'Could not accept request');
    }
  };

  // Handle reject request
  const handleReject = async (request: HomieRequest) => {
    const success = await rejectHomieRequest(request.from);
    if (success) {
      setReceivedRequests((prev) => prev.filter((r) => r.from !== request.from));
    } else {
      Alert.alert('Error', 'Could not decline request');
    }
  };

  // Filter by search
  const filteredHomies = homies.filter(
    (h) =>
      h.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredDiscoverable = discoverableUsers.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Homies</Text>
        <Pressable
          style={[styles.messageButton, { backgroundColor: theme.surface }]}
          onPress={() => router.push('/(tabs)/homies/conversations')}
        >
          <Ionicons name="chatbubble-outline" size={22} color={theme.text} />
        </Pressable>
      </View>

      {/* Tab Toggle */}
      <View style={[styles.tabContainer, { backgroundColor: theme.surface }]}>
        <Pressable
          style={[styles.tab, activeTab === 'homies' && { backgroundColor: YELLOW }]}
          onPress={() => setActiveTab('homies')}
        >
          <Text
            style={[styles.tabText, { color: activeTab === 'homies' ? DARK : theme.textSecondary }]}
          >
            My Homies
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'find' && { backgroundColor: YELLOW }]}
          onPress={() => setActiveTab('find')}
        >
          <Text
            style={[styles.tabText, { color: activeTab === 'find' ? DARK : theme.textSecondary }]}
          >
            Find
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'requests' && { backgroundColor: YELLOW }]}
          onPress={() => setActiveTab('requests')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'requests' ? DARK : theme.textSecondary },
            ]}
          >
            Requests{receivedRequests.length > 0 ? ` (${receivedRequests.length})` : ''}
          </Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={activeTab === 'find' ? 'Search riders...' : 'Search homies...'}
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      ) : activeTab === 'homies' ? (
        <FlatList
          data={filteredHomies}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No homies yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Find riders to add as homies
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <HomieCard
              homie={item}
              theme={theme}
              onPress={() => router.push(`/(tabs)/homies/${item._id}`)}
              onMessage={() => handleMessage(item)}
            />
          )}
        />
      ) : activeTab === 'find' ? (
        <FlatList
          data={filteredDiscoverable}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No riders found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {searchQuery ? 'Try a different search' : 'No discoverable users available'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <DiscoverCard
              user={item}
              theme={theme}
              isPending={sentRequests.includes(item._id)}
              onPress={() => router.push(`/(tabs)/homies/${item._id}`)}
              onSendRequest={() => handleSendRequest(item)}
            />
          )}
        />
      ) : (
        <FlatList
          data={receivedRequests}
          keyExtractor={(item) => item.from}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="mail-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No pending requests</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                When someone sends you a homie request, it will appear here
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              theme={theme}
              onAccept={() => handleAccept(item)}
              onReject={() => handleReject(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// Homie Card Component
interface HomieCardProps {
  homie: Homie;
  theme: any;
  onPress: () => void;
  onMessage: () => void;
}

function HomieCard({ homie, theme, onPress, onMessage }: HomieCardProps) {
  const sportEmoji = homie.sports?.[0] ? SPORT_EMOJIS[homie.sports[0]] || '🏆' : '👤';

  return (
    <Pressable style={[styles.card, { backgroundColor: theme.surface }]} onPress={onPress}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {homie.imageUri ? (
          <Image source={{ uri: homie.imageUri }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: theme.surfaceElevated || theme.border },
            ]}
          >
            <Text style={styles.avatarEmoji}>{sportEmoji}</Text>
          </View>
        )}
        {homie.isOnline && (
          <View style={[styles.onlineIndicator, { borderColor: theme.surface }]} />
        )}
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
          {homie.name}
        </Text>
        <Text style={[styles.cardUsername, { color: theme.textSecondary }]} numberOfLines={1}>
          {homie.email}
        </Text>
      </View>

      {/* Message Button */}
      <Pressable
        style={[styles.messageActionButton, { backgroundColor: YELLOW }]}
        onPress={onMessage}
      >
        <Ionicons name="chatbubble" size={18} color={DARK} />
      </Pressable>
    </Pressable>
  );
}

// Discover Card Component (for Find tab)
interface DiscoverCardProps {
  user: Homie;
  theme: any;
  isPending: boolean;
  onPress: () => void;
  onSendRequest: () => void;
}

function DiscoverCard({ user, theme, isPending, onPress, onSendRequest }: DiscoverCardProps) {
  const sportEmoji = user.sports?.[0] ? SPORT_EMOJIS[user.sports[0]] || '🏆' : '👤';

  return (
    <Pressable style={[styles.card, { backgroundColor: theme.surface }]} onPress={onPress}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {user.imageUri ? (
          <Image source={{ uri: user.imageUri }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: theme.surfaceElevated || theme.border },
            ]}
          >
            <Text style={styles.avatarEmoji}>{sportEmoji}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
          {user.name}
        </Text>
        <Text style={[styles.cardUsername, { color: theme.textSecondary }]} numberOfLines={1}>
          {user.email}
        </Text>
      </View>

      {/* Add Button */}
      <Pressable
        style={[styles.addButton, { backgroundColor: isPending ? theme.border : YELLOW }]}
        onPress={onSendRequest}
        disabled={isPending}
      >
        <Ionicons
          name={isPending ? 'time' : 'person-add'}
          size={18}
          color={isPending ? theme.textSecondary : DARK}
        />
      </Pressable>
    </Pressable>
  );
}

// Request Card Component
interface RequestCardProps {
  request: HomieRequest;
  theme: any;
  onAccept: () => void;
  onReject: () => void;
}

function RequestCard({ request, theme, onAccept, onReject }: RequestCardProps) {
  const user = request.user;
  const sportEmoji = user?.sports?.[0] ? SPORT_EMOJIS[user.sports[0]] || '🏆' : '👤';

  return (
    <View style={[styles.requestCard, { backgroundColor: theme.surface }]}>
      <View style={styles.requestCardTop}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {user?.imageUri ? (
            <Image source={{ uri: user.imageUri }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: theme.surfaceElevated || theme.border },
              ]}
            >
              <Text style={styles.avatarEmoji}>{sportEmoji}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
            {user?.name || 'Unknown User'}
          </Text>
          <Text style={[styles.cardUsername, { color: theme.textSecondary }]} numberOfLines={1}>
            {user?.email || request.from}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.requestActions}>
        <Pressable style={[styles.acceptButton, { backgroundColor: YELLOW }]} onPress={onAccept}>
          <Text style={styles.acceptButtonText}>Accept</Text>
        </Pressable>
        <Pressable style={[styles.declineButton, { borderColor: theme.border }]} onPress={onReject}>
          <Text style={[styles.declineButtonText, { color: theme.text }]}>Decline</Text>
        </Pressable>
      </View>
    </View>
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
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  messageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 4,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
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
    height: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },

  // Card styles
  card: {
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
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 24,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardUsername: {
    fontSize: 14,
  },
  messageActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Request card
  requestCard: {
    padding: 16,
    borderRadius: 14,
  },
  requestCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: DARK,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
