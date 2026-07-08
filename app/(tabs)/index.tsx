/**
 * Home Screen (Dashboard)
 * Action-oriented dashboard for quick access to core features
 *
 * Layout:
 * - Header: Avatar + "Yo, {name}!" + messages icon (badge) + settings icon
 * - Primary Actions: 3 large cards (Add Trick, Trickipedia, Find a Spot)
 * - Companion Widget: Kaori AI companion quick-launch
 * - Current Goals: Horizontal scroll of GoalCards
 * - Feed CTA: Banner to browse the feed
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
import { ActionCard, ActivityCard, CompanionWidget, FeedCTA, GoalCard } from '@/components/home';
import { Avatar, Card, CountBadge, IconButton, SectionHeader } from '@/components/ui';
import { colors as brandColors } from '@/constants/colors';
import { apiClient } from '@/lib/api/client';
import { getMyHomies, type Homie } from '@/lib/api/homies';
import { getUnreadCount } from '@/lib/api/messages';
import { getUserTrickLists } from '@/lib/api/trickbook';
import { type ActivityItem, getHomieActivity } from '@/lib/api/user';
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

interface Bot {
  _id: string;
  name: string;
  bio?: string;
  imageUri?: string;
  botCharacter?: string;
}

export default function HomeScreen() {
  const { theme, colors, isDark } = useThemeContext();
  const { user, token } = useAuthStore();

  const [trickLists, setTrickLists] = useState<TrickList[]>([]);
  const [homies, setHomies] = useState<Homie[]>([]);
  const [homieActivity, setHomieActivity] = useState<
    (ActivityItem & { userName?: string; userImage?: string })[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [companion, setCompanion] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch data on mount
  const fetchData = useCallback(async () => {
    if (!user?.id || !token) return;

    try {
      const [listsData, homiesData, unreadData, botsData] = await Promise.all([
        getUserTrickLists(user.id, token).catch(() => []),
        getMyHomies().catch(() => []),
        getUnreadCount().catch(() => 0),
        apiClient.get<Bot[]>('/bot-chat/bots').catch(() => []),
      ]);

      setTrickLists(listsData);
      setHomies(homiesData);
      setUnreadCount(unreadData);

      const bots = Array.isArray(botsData) ? botsData : [];
      setCompanion(bots[0] || null);

      // Fetch homie activity if we have homies
      if (homiesData.length > 0) {
        const homieIds = homiesData.map((h) => h._id);
        const activities = await getHomieActivity(homieIds, 10).catch(() => []);

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

  // Extract current goals from trick lists
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
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    })
    .slice(0, 5);

  // Get user display name and avatar
  const displayName = user?.name || 'Rider';
  const avatarEmoji = user?.riderProfile?.avatarIcon?.emoji || '🛹';
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
                params: { userId: user?.id || user?._id || '', from: 'home' },
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

          <View style={styles.headerRight}>
            <View style={styles.iconWithBadge}>
              <IconButton
                icon="chatbubble-outline"
                variant="secondary"
                onPress={() => router.push('/(tabs)/homies/conversations')}
              />
              {unreadCount > 0 && (
                <View style={styles.badgePosition}>
                  <CountBadge count={unreadCount} />
                </View>
              )}
            </View>
            <IconButton
              icon="settings-outline"
              variant="secondary"
              onPress={() => router.push('/profile/settings')}
            />
          </View>
        </View>

        {/* Primary Action Cards */}
        <View style={styles.actionsRow}>
          <ActionCard
            icon="add-circle"
            label="Add Trick"
            sublabel="Track progress"
            onPress={() => router.push('/(tabs)/trickbook')}
          />
          <ActionCard
            icon="book"
            label="Trickipedia"
            sublabel="Learn new tricks"
            onPress={() => router.push('/(tabs)/trickbook')}
          />
          <ActionCard
            icon="location"
            label="Find a Spot"
            sublabel="Explore nearby"
            onPress={() => router.push('/(tabs)/spots')}
          />
        </View>

        {/* Companion Widget */}
        <View style={styles.sectionPadded}>
          <CompanionWidget
            bot={companion}
            onPress={() => companion && router.push(`/(tabs)/homies/bot-chat/${companion._id}`)}
            onView3D={
              // 3D stage only exists for Kaori so far
              companion &&
              (companion.botCharacter ?? companion.name).toLowerCase().includes('kaori')
                ? () =>
                    router.push({
                      pathname: '/(tabs)/homies/companion-stage/[botId]',
                      params: { botId: companion._id, name: companion.name },
                    })
                : undefined
            }
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

        {/* Feed CTA */}
        <View style={styles.sectionPadded}>
          <FeedCTA onPress={() => router.push('/(tabs)/media?tab=feed')} />
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
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWithBadge: {
    position: 'relative',
  },
  badgePosition: {
    position: 'absolute',
    top: -2,
    right: -2,
    zIndex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderPadded: {
    paddingHorizontal: 20,
  },
  sectionPadded: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  goalsScroll: {
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
