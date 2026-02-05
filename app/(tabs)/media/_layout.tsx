/**
 * Media Layout
 * Stack navigator for Media screens
 */

import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { colors } from '@/constants/colors';

export default function MediaLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="video/[videoId]" />
      <Stack.Screen name="collection/[collectionId]" />
      <Stack.Screen name="post/[postId]" />
      <Stack.Screen name="upload" />
    </Stack>
  );
}
