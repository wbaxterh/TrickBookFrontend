/**
 * Profile Screen
 * User's own profile view
 */

import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

export default function ProfileScreen() {
  const { theme, colors } = useThemeContext();
  const { user } = useAuthStore();

  const stats = user?.stats || { spots: 0, followers: 0, following: 0, tricks: 0 };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={['top']}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <Pressable
            className="w-10 h-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.surface }}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text className="text-xl font-bold" style={{ color: theme.text }}>
            Profile
          </Text>
          <Pressable
            className="w-10 h-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.surface }}
            onPress={() => router.push('/profile/settings')}
          >
            <Ionicons name="settings-outline" size={22} color={theme.text} />
          </Pressable>
        </View>

        {/* Profile Info */}
        <View className="items-center px-6 mb-6">
          {/* Avatar */}
          <View
            className="w-24 h-24 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: colors.primary }}
          >
            {user?.imageUri ? (
              <Image
                source={{ uri: user.imageUri }}
                className="w-24 h-24 rounded-full"
              />
            ) : (
              <Text className="text-4xl">🛹</Text>
            )}
          </View>

          {/* Name & Username */}
          <Text className="text-2xl font-bold mb-1" style={{ color: theme.text }}>
            {user?.name || 'Rider'}
          </Text>
          <Text className="text-base mb-4" style={{ color: theme.textSecondary }}>
            @{user?.name?.toLowerCase().replace(/\s+/g, '') || 'rider'}
          </Text>

          {/* Edit Profile Button */}
          <Pressable
            className="px-6 py-2 rounded-full border"
            style={{ borderColor: theme.border }}
            onPress={() => router.push('/profile/edit')}
          >
            <Text className="font-medium" style={{ color: theme.text }}>
              Edit Profile
            </Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View
          className="flex-row mx-6 p-4 rounded-xl mb-6"
          style={{ backgroundColor: theme.surface }}
        >
          <StatItem value={stats.tricks} label="Tricks" theme={theme} />
          <StatItem value={stats.spots} label="Spots" theme={theme} />
          <StatItem value={stats.followers} label="Followers" theme={theme} />
          <StatItem value={stats.following} label="Following" theme={theme} />
        </View>

        {/* Bio */}
        {user?.riderProfile?.bio && (
          <View className="px-6 mb-6">
            <Text className="text-sm" style={{ color: theme.textSecondary }}>
              {user.riderProfile.bio}
            </Text>
          </View>
        )}

        {/* Sports */}
        <View className="px-6 mb-6">
          <Text
            className="text-sm font-semibold mb-3"
            style={{ color: theme.textSecondary }}
          >
            SPORTS
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {(user?.sports || ['skateboard']).map((sport) => (
              <View
                key={sport}
                className="px-4 py-2 rounded-full"
                style={{ backgroundColor: theme.surface }}
              >
                <Text className="font-medium" style={{ color: theme.text }}>
                  {getSportEmoji(sport)} {sport}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Subscription Badge */}
        {user?.subscription?.plan === 'premium' && (
          <View className="px-6 mb-6">
            <View
              className="flex-row items-center p-4 rounded-xl"
              style={{ backgroundColor: colors.premium + '20' }}
            >
              <Ionicons name="checkmark-circle" size={24} color={colors.premium} />
              <View className="ml-3">
                <Text className="font-semibold" style={{ color: colors.premium }}>
                  TrickBook Plus
                </Text>
                <Text className="text-sm" style={{ color: theme.textSecondary }}>
                  Verified member
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Activity Placeholder */}
        <View className="px-6">
          <Text
            className="text-sm font-semibold mb-3"
            style={{ color: theme.textSecondary }}
          >
            RECENT ACTIVITY
          </Text>
          <View
            className="p-8 rounded-xl items-center"
            style={{ backgroundColor: theme.surface }}
          >
            <Ionicons name="time-outline" size={48} color={theme.textSecondary} />
            <Text
              className="mt-4 text-base font-medium"
              style={{ color: theme.text }}
            >
              No recent activity
            </Text>
            <Text
              className="mt-1 text-sm text-center"
              style={{ color: theme.textSecondary }}
            >
              Start logging tricks and sessions to see your activity here
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({
  value,
  label,
  theme,
}: {
  value: number;
  label: string;
  theme: any;
}) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-xl font-bold" style={{ color: theme.text }}>
        {value}
      </Text>
      <Text className="text-xs" style={{ color: theme.textSecondary }}>
        {label}
      </Text>
    </View>
  );
}

function getSportEmoji(sport: string): string {
  const emojis: Record<string, string> = {
    skateboard: '🛹',
    snowboard: '🏂',
    bmx: '🚲',
    scooter: '🛴',
    rollerblade: '⛸️',
    surfing: '🏄',
  };
  return emojis[sport] || '🏆';
}
