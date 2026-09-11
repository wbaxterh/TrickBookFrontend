/**
 * Homies Layout
 * Stack navigator for Homies screens
 */

import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { colors } from '@/constants/colors';

export default function HomiesLayout() {
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
      <Stack.Screen name="conversations" />
      <Stack.Screen name="new-chat" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[userId]" />
      <Stack.Screen name="chat/[conversationId]" />
      <Stack.Screen name="bot-chat/[botId]" />
      <Stack.Screen
        name="companion-stage/[botId]"
        options={{ contentStyle: { backgroundColor: '#0b0e17' } }}
      />
    </Stack>
  );
}
