/**
 * Spots Layout
 * Stack navigator for Spots screens
 */

import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { colors } from '@/constants/colors';

export default function SpotsLayout() {
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
      <Stack.Screen name="add" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="[spotId]" />
      <Stack.Screen name="list/[listId]" />
    </Stack>
  );
}
