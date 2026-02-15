/**
 * Notifications Screen
 * Shows user notifications
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

// Mock data
const MOCK_NOTIFICATIONS = [
  {
    id: '1',
    type: 'follow',
    user: 'Alex Thompson',
    message: 'started following you',
    timeAgo: '2h',
    read: false,
  },
  {
    id: '2',
    type: 'like',
    user: 'Jordan Lee',
    message: 'liked your video',
    timeAgo: '5h',
    read: false,
  },
  {
    id: '3',
    type: 'comment',
    user: 'Sam Rivera',
    message: 'commented on your post: "Sick trick! 🔥"',
    timeAgo: '1d',
    read: true,
  },
  {
    id: '4',
    type: 'trick',
    user: null,
    message: 'Congrats! You landed Kickflip',
    timeAgo: '2d',
    read: true,
  },
];

export default function NotificationsScreen() {
  const { theme, colors } = useThemeContext();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow':
        return 'person-add';
      case 'like':
        return 'heart';
      case 'comment':
        return 'chatbubble';
      case 'trick':
        return 'trophy';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'follow':
        return colors.secondary;
      case 'like':
        return colors.error;
      case 'comment':
        return colors.info;
      case 'trick':
        return colors.primary;
      default:
        return theme.textSecondary;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-6 py-4">
        <Pressable
          className="w-10 h-10 items-center justify-center rounded-full mr-3"
          style={{ backgroundColor: theme.surface }}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>
        <Text className="text-xl font-bold" style={{ color: theme.text }}>
          Notifications
        </Text>
      </View>

      <FlatList
        data={MOCK_NOTIFICATIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Ionicons name="notifications-off-outline" size={48} color={theme.textSecondary} />
            <Text className="mt-4 text-lg font-semibold" style={{ color: theme.text }}>
              No notifications
            </Text>
            <Text className="mt-1 text-center" style={{ color: theme.textSecondary }}>
              You're all caught up!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            className="flex-row items-center p-4 rounded-xl"
            style={{
              backgroundColor: item.read ? theme.surface : `${colors.primary}15`,
            }}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: `${getNotificationColor(item.type)}20` }}
            >
              <Ionicons
                name={getNotificationIcon(item.type) as any}
                size={20}
                color={getNotificationColor(item.type)}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm" style={{ color: theme.text }}>
                {item.user && <Text className="font-semibold">{item.user} </Text>}
                {item.message}
              </Text>
              <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                {item.timeAgo}
              </Text>
            </View>
            {!item.read && (
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.primary }} />
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
