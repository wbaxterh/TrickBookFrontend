/**
 * Home Screen (Dashboard)
 * Personal dashboard matching HomeScreen.png design
 *
 * Layout:
 * - Header: Avatar + "Yo, {name}!" (name in gold) + settings icon
 * - Current Goals: Horizontal scroll of GoalCards
 * - Split row: Progress Stats | Quick Actions (2x2)
 * - Homie Activity: Horizontal scroll
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityCard, GoalCard, QuickActions, StatsCard } from '@/components/home';
import { Avatar, Card, IconButton, SectionHeader } from '@/components/ui';
import { colors as brandColors } from '@/constants/colors';
import { getMyHomies, type Homie } from '@/lib/api/homies';
import { getUserTrickLists } from '@/lib/api/trickbook';
import { type ActivityItem, getHomieActivity, getUserStats, type UserStats } from '@/lib/api/user';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import type { TrickList, TrickListItem } from '@/types/trickbook';

// Transform trick status from backend to GoalCard format
function mapTrickStatus(
  status?: string,
  checked?: string,
): 'learning' | 'landed' | 'notStarted' | 'mastered' {
  if (status === 'Learning') return 'learning';
  if (status === 'Landed') return 'landed';
  if (status === 'Mastered') return 'mastered';
  if (checked === 'Complete') return 'landed';
  return 'notStarted';
}

// Get progress percentage based on status
function getStatusProgress(status: 'learning' | 'landed' | 'notStarted' | 'mastered'): number {
  switch (status) {
    case 'mastered':
      return 100;
    case 'landed':
      return 100;
    case 'learning':
      return 50;
    default:
      return 0;
  }
}

// Get relative time string
function _getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function HomeScreen() {
  const { theme, colors, isDark } = useThemeContext();
  const { user, token } = useAuthStore();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [trickLists, setTrickLists] = useState<TrickList[]>([]);
  const [homies, setHomies] = useState<Homie[]>([]);
  const [homieActivity, setHomieActivity] = useState<
    (ActivityItem & { userName?: string; userImage?: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch data on mount
  const fetchData = useCallback(async () => {
    if (!user?.id || !token) return;

    try {
      const [statsData, listsData, homiesData] = await Promise.all([
        getUserStats(user.id).catch(() => null),
        getUserTrickLists(user.id, token).catch(() => []),
        getMyHomies().catch(() => []),
      ]);

      if (statsData) setStats(statsData);
      setTrickLists(listsData);
      setHomies(homiesData);

      // Fetch homie activity if we have homies
      if (homiesData.length > 0) {
        const homieIds = homiesData.map((h) => h._id);
        const activities = await getHomieActivity(homieIds, 10).catch(() => []);

        // Enrich activities with user info
        const enrichedActivities = activities.map((activity) => {
          const homie = homiesData.find(
            (h) => h._id === activity.data?.userId || h._id === (activity as any).userId,
          );
          return {
            ...activity,
            userName: homie?.name,
            userImage: homie?.imageUri || undefined,
          };
        });

        setHomieActivity(enrichedActivities);
      }
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  }, [user?.id, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Extract current goals from trick lists - sorted by most recent activity first
  // Prioritize updatedAt (when trick was edited/status changed) over createdAt
  const currentGoals = trickLists
    .flatMap((list: TrickList) =>
      (list.tricks || []).map((trick: TrickListItem) => ({
        id: trick._id,
        listId: list._id,
        name: trick.name,
        status: mapTrickStatus(trick.status, trick.checked),
        progress: getStatusProgress(mapTrickStatus(trick.status, trick.checked)),
        timestamp: trick.updatedAt || trick.createdAt || list.updatedAt || list.createdAt || '',
      })),
    )
    .sort((a, b) => {
      // Tricks with timestamps come first, sorted newest to oldest
      // Tricks without timestamps go to the end
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    })
    .slice(0, 5);

  // Calculate stats
  const totalLanded =
    stats?.tricklistCount ||
    trickLists.reduce(
      (acc: number, list: TrickList) =>
        acc +
        (list.tricks || []).filter(
          (t: TrickListItem) =>
            t.status === 'Landed' || t.status === 'Mastered' || t.checked === 'Complete',
        ).length,
      0,
    );

  // Quick actions configuration
  const quickActions = [
    {
      id: 'add-trick',
      label: 'Add Trick',
      icon: 'sparkles' as const,
      onPress: () => router.push('/(tabs)/trickbook'),
    },
    {
      id: 'feed',
      label: 'The Feed',
      icon: 'play' as const,
      onPress: () => router.push('/(tabs)/media?tab=feed'),
    },
    {
      id: 'trickipedia',
      label: 'Open Trickipedia',
      icon: 'book' as const,
      onPress: () => router.push('/(tabs)/trickbook'),
    },
    {
      id: 'find-spot',
      label: 'Find Spot',
      icon: 'location' as const,
      onPress: () => router.push('/(tabs)/spots'),
    },
  ];

  // Get user display name and avatar
  const displayName = user?.name || 'Rider';
  const avatarEmoji = user?.riderProfile?.avatarIcon?.emoji || '🛹';
  const _avatarBg = user?.riderProfile?.avatarIcon?.bg;
  const isPremium = user?.subscription?.plan === 'premium';

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerLeft}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/profile/[userId]',
                params: { userId: user?.id || user?._id, from: 'home' },
              })
            }
          >
            <Avatar
              size="lg"
              imageUri={user?.imageUri}
              name={displayName}
              emoji={avatarEmoji}
              isVerified={isPremium}
            />
            <Text style={[styles.greeting, { color: theme.text }]}>
              Yo,{' '}
              <Text style={{ color: isDark ? brandColors.primary : brandColors.primaryText }}>
                {displayName.split(' ')[0]}
              </Text>
              !
            </Text>
          </Pressable>

          <IconButton
            icon="settings-outline"
            variant="secondary"
            onPress={() => router.push('/profile/settings')}
          />
        </View>

        {/* Current Goals - Horizontal Scroll */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderPadded}>
            <SectionHeader
              title="Current Goals"
              action={{
                label: 'View All',
                onPress: () =>
                  router.push({ pathname: '/(tabs)/trickbook', params: { tab: 'mylists' } }),
              }}
            />
          </View>

          {currentGoals.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.goalsScroll}
            >
              {currentGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  trickName={goal.name}
                  status={goal.status}
                  progress={goal.progress}
                  onUpdate={() => {
                    router.push(`/(tabs)/trickbook/list/${goal.listId}`);
                  }}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.sectionPadded}>
              <Card padding="lg">
                <View style={styles.emptyState}>
                  <Ionicons name="list-outline" size={40} color={theme.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No tricks tracked yet. Start adding tricks to your TrickBook!
                  </Text>
                  <Pressable
                    style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                    onPress={() => router.push('/(tabs)/trickbook')}
                  >
                    <Text style={styles.emptyButtonText}>Open TrickBook</Text>
                  </Pressable>
                </View>
              </Card>
            </View>
          )}
        </View>

        {/* Stats + Quick Actions Row */}
        <View style={[styles.section, styles.splitRow]}>
          {/* Progress Stats */}
          <StatsCard
            title="Progress Stats"
            stats={[
              { label: 'Total Landed', value: totalLanded },
              { label: 'Homies', value: stats?.homiesCount || 0 },
            ]}
          />

          {/* Quick Actions */}
          <QuickActions title="Quick Actions" actions={quickActions} />
        </View>

        {/* Homie Activity - Horizontal Scroll */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderPadded}>
            <SectionHeader
              title="Homie Activity"
              action={{
                label: 'See All',
                onPress: () => router.push('/(tabs)/homies'),
              }}
            />
          </View>

          {homieActivity.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activityScroll}
            >
              {homieActivity.map((activity, index) => {
                // Determine activity type and subject from the activity data
                const activityType =
                  activity.type === 'post' ? 'added' : activity.type === 'spot' ? 'spot' : 'added';
                const subject =
                  activity.data?.caption || activity.data?.name || activity.action || 'content';

                return (
                  <ActivityCard
                    key={`${activity.data?._id || index}-${index}`}
                    user={{
                      id: (activity as any).userId || '',
                      name: activity.userName || 'Homie',
                      imageUri: activity.userImage,
                    }}
                    activityType={activityType}
                    subject={subject}
                    timestamp={activity.createdAt}
                    onPress={() => {
                      if (activity.type === 'post' && activity.data?._id) {
                        router.push(`/(tabs)/media/post/${activity.data._id}`);
                      } else if (activity.type === 'spot' && activity.data?._id) {
                        router.push(`/(tabs)/spots/${activity.data._id}`);
                      }
                    }}
                  />
                );
              })}
            </ScrollView>
          ) : homies.length > 0 ? (
            <View style={styles.sectionPadded}>
              <Card padding="lg">
                <View style={styles.emptyState}>
                  <Ionicons name="time-outline" size={40} color={theme.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No recent activity from your homies
                  </Text>
                </View>
              </Card>
            </View>
          ) : (
            <View style={styles.sectionPadded}>
              <Card padding="lg">
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={40} color={theme.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Connect with homies to see their activity here
                  </Text>
                  <Pressable
                    style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                    onPress={() => router.push('/(tabs)/homies')}
                  >
                    <Text style={styles.emptyButtonText}>Find Homies</Text>
                  </Pressable>
                </View>
              </Card>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderPadded: {
    paddingHorizontal: 20,
  },
  sectionPadded: {
    paddingHorizontal: 20,
  },
  goalsScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  splitRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  activityScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  emptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
});
