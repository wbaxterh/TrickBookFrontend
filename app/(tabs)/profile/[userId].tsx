/**
 * User Profile Screen
 * Shows user profile, stats, rider info, and recent activity
 * Works for both viewing own profile and other users' profiles
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  getPublicProfile,
  getUserStats,
  getUserActivity,
  PublicProfile,
  UserStats,
  ActivityItem,
} from '@/lib/api/user';
import { getUserPosts, FeedPost } from '@/lib/api/feed';
import {
  getHomieStatus,
  sendHomieRequest,
  removeHomie,
  HomieStatus,
} from '@/lib/api/homies';
import { getOrCreateConversation } from '@/lib/api/messages';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

// Sport emoji mapping
const SPORT_EMOJIS: Record<string, string> = {
  skateboarding: '🛹',
  snowboarding: '🏂',
  skiing: '⛷️',
  bmx: '🚴',
  mtb: '🚵',
  scooter: '🛴',
  surfing: '🏄',
  wakeboarding: '🏄',
  rollerblading: '⛸️',
};

export default function ProfileScreen() {
  const { userId, from } = useLocalSearchParams<{ userId: string; from?: string }>();
  const { theme, colors, isDark } = useThemeContext();
  const { user: currentUser } = useAuthStore();

  // Smart back navigation based on where user came from
  const handleBack = () => {
    if (from === 'homies') {
      router.replace('/(tabs)/homies');
    } else if (from === 'feed') {
      router.replace('/(tabs)/media?tab=feed');
    } else if (from === 'home') {
      router.replace('/(tabs)');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback to home if no history
      router.replace('/(tabs)');
    }
  };

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [recentPosts, setRecentPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'activity'>('about');
  const [homieStatus, setHomieStatus] = useState<HomieStatus>('none');
  const [actionLoading, setActionLoading] = useState(false);

  const isOwnProfile = currentUser?.id === userId || currentUser?._id === userId;

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      const [profileData, statsData, activityData, postsData] = await Promise.all([
        getPublicProfile(userId),
        getUserStats(userId),
        getUserActivity(userId, { limit: 10 }),
        getUserPosts(userId, { limit: 6 }),
      ]);

      setProfile(profileData);
      setStats(statsData);
      setActivities(activityData.activities);
      setRecentPosts(postsData.posts);

      // Fetch homie status if viewing another user's profile
      if (!isOwnProfile) {
        const status = await getHomieStatus(userId);
        setHomieStatus(status);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, isOwnProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Handle message button
  const handleMessage = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const conversation = await getOrCreateConversation(userId);
      if (conversation) {
        router.push(`/(tabs)/homies/chat/${conversation._id}`);
      } else {
        Alert.alert('Error', 'Could not start conversation');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not start conversation');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle add homie
  const handleAddHomie = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const success = await sendHomieRequest(userId);
      if (success) {
        setHomieStatus('pending');
        Alert.alert('Request Sent', `Homie request sent to ${profile?.name || 'user'}`);
      } else {
        Alert.alert('Error', 'Could not send homie request');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not send homie request');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle remove homie
  const handleRemoveHomie = () => {
    Alert.alert(
      'Remove Homie',
      `Are you sure you want to remove ${profile?.name || 'this user'} from your homies?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            setActionLoading(true);
            try {
              const success = await removeHomie(userId);
              if (success) {
                setHomieStatus('none');
              } else {
                Alert.alert('Error', 'Could not remove homie');
              }
            } catch (error) {
              Alert.alert('Error', 'Could not remove homie');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={[styles.backButton, { backgroundColor: theme.surface }]} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={[styles.backButton, { backgroundColor: theme.surface }]} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.errorText, { color: theme.text }]}>Profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPremium = profile.subscription?.plan === 'premium' &&
    ['active', 'canceled'].includes(profile.subscription?.status || '');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={[styles.backButton, { backgroundColor: theme.surface }]} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
        {isOwnProfile ? (
          <Pressable
            style={[styles.backButton, { backgroundColor: theme.surface }]}
            onPress={() => router.push('/profile/settings')}
          >
            <Ionicons name="settings-outline" size={22} color={theme.text} />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {profile.imageUri ? (
              <Image source={{ uri: profile.imageUri }} style={styles.avatar} />
            ) : profile.riderProfile?.avatarIcon ? (
              <View style={[styles.avatar, styles.avatarIcon, { backgroundColor: profile.riderProfile.avatarIcon.bg || YELLOW }]}>
                <Text style={styles.avatarEmoji}>{profile.riderProfile.avatarIcon.emoji}</Text>
              </View>
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.surface }]}>
                <Ionicons name="person" size={48} color={theme.textSecondary} />
              </View>
            )}
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Ionicons name="star" size={14} color={DARK} />
              </View>
            )}
          </View>

          {/* Name & Info */}
          <Text style={[styles.profileName, { color: theme.text }]}>{profile.name}</Text>
          {profile.riderProfile?.nickname && (
            <Text style={[styles.nickname, { color: theme.textSecondary }]}>@{profile.riderProfile.nickname}</Text>
          )}
          {profile.riderProfile?.motto && (
            <Text style={[styles.motto, { color: theme.textSecondary }]}>"{profile.riderProfile.motto}"</Text>
          )}

          {/* Sports */}
          {profile.sports && profile.sports.length > 0 && (
            <View style={styles.sportsRow}>
              {profile.sports.map((sport) => (
                <View key={sport} style={[styles.sportBadge, { backgroundColor: theme.surface }]}>
                  <Text style={styles.sportEmoji}>{SPORT_EMOJIS[sport] || '🎿'}</Text>
                  <Text style={[styles.sportText, { color: theme.text }]}>
                    {sport.charAt(0).toUpperCase() + sport.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          {!isOwnProfile && (
            <View style={styles.actionButtons}>
              {homieStatus === 'homies' ? (
                <>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: YELLOW }]}
                    onPress={handleMessage}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color={DARK} />
                    ) : (
                      <>
                        <Ionicons name="chatbubble" size={18} color={DARK} />
                        <Text style={styles.actionButtonText}>Message</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.actionButtonSecondary, { backgroundColor: theme.surface }]}
                    onPress={handleRemoveHomie}
                    disabled={actionLoading}
                  >
                    <Ionicons name="person-remove-outline" size={18} color={theme.text} />
                  </Pressable>
                </>
              ) : homieStatus === 'pending' ? (
                <View style={[styles.pendingButton, { backgroundColor: theme.surface }]}>
                  <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.pendingButtonText, { color: theme.textSecondary }]}>
                    Request Pending
                  </Text>
                </View>
              ) : homieStatus === 'received' ? (
                <View style={[styles.pendingButton, { backgroundColor: theme.surface }]}>
                  <Ionicons name="mail-outline" size={18} color={YELLOW} />
                  <Text style={[styles.pendingButtonText, { color: YELLOW }]}>
                    Wants to be your homie
                  </Text>
                </View>
              ) : (
                <Pressable
                  style={[styles.actionButton, { backgroundColor: YELLOW }]}
                  onPress={handleAddHomie}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color={DARK} />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={18} color={DARK} />
                      <Text style={styles.actionButtonText}>Add Homie</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Stats Bar */}
        <View style={[styles.statsCard, { backgroundColor: theme.surface }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: YELLOW }]}>{stats?.homiesCount || 0}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Homies</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: YELLOW }]}>{stats?.tricklistCount || 0}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>TrickLists</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: YELLOW }]}>{stats?.postCount || 0}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Posts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: YELLOW }]}>{stats?.spotCount || 0}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Spots</Text>
          </View>
        </View>

        {/* Engagement Stats */}
        <View style={styles.engagementRow}>
          <View style={[styles.engagementItem, { backgroundColor: theme.surface }]}>
            <Ionicons name="heart" size={20} color="#ef4444" />
            <Text style={[styles.engagementValue, { color: theme.text }]}>{stats?.totalLove || 0}</Text>
            <Text style={[styles.engagementLabel, { color: theme.textSecondary }]}>Love</Text>
          </View>
          <View style={[styles.engagementItem, { backgroundColor: theme.surface }]}>
            <Text style={styles.engagementEmoji}>🙏</Text>
            <Text style={[styles.engagementValue, { color: theme.text }]}>{stats?.totalRespect || 0}</Text>
            <Text style={[styles.engagementLabel, { color: theme.textSecondary }]}>Respect</Text>
          </View>
        </View>

        {/* Tab Toggle */}
        <View style={[styles.tabContainer, { backgroundColor: theme.surface }]}>
          <Pressable
            style={[styles.tab, activeTab === 'about' && { backgroundColor: YELLOW }]}
            onPress={() => setActiveTab('about')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'about' ? DARK : theme.textSecondary }]}>About</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'activity' && { backgroundColor: YELLOW }]}
            onPress={() => setActiveTab('activity')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'activity' ? DARK : theme.textSecondary }]}>Activity</Text>
          </Pressable>
        </View>

        {activeTab === 'about' ? (
          <>
            {/* Rider Info */}
            {profile.riderProfile && (
              <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Rider Info</Text>

                {profile.riderProfile.riderStyle && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Style</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>{profile.riderProfile.riderStyle}</Text>
                  </View>
                )}
                {profile.riderProfile.stance && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Stance</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>{profile.riderProfile.stance}</Text>
                  </View>
                )}
                {profile.riderProfile.sickestTrick && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Sickest Trick</Text>
                    <Text style={[styles.infoValue, { color: YELLOW }]}>{profile.riderProfile.sickestTrick}</Text>
                  </View>
                )}
                {profile.riderProfile.homeSpot && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Home Spot</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>{profile.riderProfile.homeSpot}</Text>
                  </View>
                )}
                {profile.riderProfile.nationality && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>From</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>{profile.riderProfile.nationality}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Recent Posts Grid */}
            {recentPosts.length > 0 && (
              <View style={styles.postsSection}>
                <View style={styles.postsSectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Posts</Text>
                  <Pressable onPress={() => router.push(`/(tabs)/media/my-posts`)}>
                    <Text style={[styles.seeAllText, { color: YELLOW }]}>See All</Text>
                  </Pressable>
                </View>
                <View style={styles.postsGrid}>
                  {recentPosts.slice(0, 6).map((post) => (
                    <Pressable
                      key={post._id}
                      style={styles.postThumbnail}
                      onPress={() => router.push(`/(tabs)/media/post/${post._id}`)}
                    >
                      {post.thumbnailUrl || post.imageUrls?.[0] ? (
                        <Image
                          source={{ uri: post.thumbnailUrl || post.imageUrls?.[0] }}
                          style={styles.postImage}
                        />
                      ) : (
                        <View style={[styles.postImage, styles.postPlaceholder, { backgroundColor: theme.surface }]}>
                          <Ionicons name="image" size={24} color={theme.textSecondary} />
                        </View>
                      )}
                      {post.mediaType === 'video' && (
                        <View style={styles.videoIndicator}>
                          <Ionicons name="play" size={12} color="#fff" />
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          /* Activity Tab */
          <View style={styles.activitySection}>
            {activities.length === 0 ? (
              <View style={styles.emptyActivity}>
                <Ionicons name="time-outline" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No recent activity</Text>
              </View>
            ) : (
              activities.map((activity, index) => (
                <View key={`${activity.type}-${index}`} style={[styles.activityItem, { backgroundColor: theme.surface }]}>
                  <View style={[styles.activityIcon, { backgroundColor: YELLOW + '25' }]}>
                    <Ionicons
                      name={
                        activity.type === 'post' ? 'videocam' :
                        activity.type === 'reaction' ? 'heart' :
                        activity.type === 'comment' ? 'chatbubble' : 'location'
                      }
                      size={18}
                      color={YELLOW}
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityText, { color: theme.text }]}>{activity.action}</Text>
                    <Text style={[styles.activityTime, { color: theme.textSecondary }]}>
                      {formatTimeAgo(activity.createdAt)}
                    </Text>
                  </View>
                  {activity.data?.thumbnailUrl && (
                    <Image source={{ uri: activity.data.thumbnailUrl }} style={styles.activityThumbnail} />
                  )}
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 48,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#121212',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
  },
  nickname: {
    fontSize: 15,
    marginTop: 4,
  },
  motto: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  sportsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  sportEmoji: {
    fontSize: 16,
  },
  sportText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: DARK,
  },
  actionButtonSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  pendingButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  engagementRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  engagementItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  engagementEmoji: {
    fontSize: 18,
  },
  engagementValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  engagementLabel: {
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    padding: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  postsSection: {
    paddingHorizontal: 20,
  },
  postsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  postThumbnail: {
    width: (SCREEN_WIDTH - 48) / 3,
    height: (SCREEN_WIDTH - 48) / 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 4,
  },
  activitySection: {
    paddingHorizontal: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 12,
    marginTop: 2,
  },
  activityThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginLeft: 12,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
  },
});
