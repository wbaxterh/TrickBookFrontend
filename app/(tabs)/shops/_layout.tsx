/**
 * Shops Layout
 * Stack navigator for the Shops directory. The list itself is rendered inside
 * the Spots tab (Spots · Events · Shops segment); these routes back the detail.
 */

import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { colors } from '@/constants/colors';

export default function ShopsLayout() {
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
      <Stack.Screen name="[slugOrId]" />
    </Stack>
  );
}
