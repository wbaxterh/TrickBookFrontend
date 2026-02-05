/**
 * Homie Profile Redirect
 * Redirects to the unified profile screen with source tracking
 */

import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function HomieProfileRedirect() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  useEffect(() => {
    if (userId) {
      // Use replace so back button works correctly
      // Pass 'from' param so profile knows where to go back to
      router.replace({
        pathname: '/(tabs)/profile/[userId]',
        params: { userId, from: 'homies' },
      });
    }
  }, [userId]);

  // Show loading while redirecting
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
      <ActivityIndicator size="large" color="#FCF150" />
    </View>
  );
}
