/**
 * Profile Layout
 * Stack navigator for profile screens
 */

import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { colors } from '@/constants/colors';

export default function ProfileLayout() {
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
      <Stack.Screen name="edit" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="account" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="theme" />
      <Stack.Screen name="language" />
      <Stack.Screen name="support" />
      <Stack.Screen name="change-password" />
    </Stack>
  );
}
