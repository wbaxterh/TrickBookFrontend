/**
 * Auth Layout
 * Stack navigator for authentication screens
 */

import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { colors } from '@/constants/colors';

export default function AuthLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: isDark
            ? colors.dark.background
            : colors.light.background,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
