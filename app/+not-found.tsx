/**
 * Not Found Screen
 * Displayed when navigating to a route that doesn't exist
 */

import { View, Text, Pressable } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

export default function NotFoundScreen() {
  const { theme, colors } = useThemeContext();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View
        className="flex-1 items-center justify-center p-6"
        style={{ backgroundColor: theme.background }}
      >
        <Text className="text-6xl mb-4">🤔</Text>
        <Text
          className="text-2xl font-bold mb-2"
          style={{ color: theme.text }}
        >
          Page Not Found
        </Text>
        <Text
          className="text-base text-center mb-8"
          style={{ color: theme.textSecondary }}
        >
          The page you're looking for doesn't exist.
        </Text>
        <Link href="/" asChild>
          <Pressable
            className="px-6 py-3 rounded-xl"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-base font-semibold" style={{ color: '#000' }}>
              Go Home
            </Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
