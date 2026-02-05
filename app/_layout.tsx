/**
 * Root Layout
 * Sets up providers, fonts, and navigation structure
 */

import { useEffect, useState } from 'react';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import { colors } from '@/constants/colors';
import '../global.css';

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loadStoredAuth } = useAuthStore();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Load stored auth on mount
  useEffect(() => {
    loadStoredAuth().finally(() => setHasCheckedAuth(true));
  }, []);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!navigationState?.key || !hasCheckedAuth || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    // Use setTimeout to ensure navigation happens after render cycle
    const timer = setTimeout(() => {
      if (!isAuthenticated && !inAuthGroup) {
        // Not logged in, redirect to welcome screen
        router.replace('/(auth)/welcome');
      } else if (isAuthenticated && inAuthGroup) {
        // Logged in but on auth screen, redirect to home
        router.replace('/(tabs)');
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isAuthenticated, segments, navigationState?.key, hasCheckedAuth, isLoading]);

  // Show loading screen while checking auth
  if (isLoading || !hasCheckedAuth) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.dark.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthGate>
            <View
              style={{
                flex: 1,
                backgroundColor: isDark
                  ? colors.dark.background
                  : colors.light.background,
              }}
            >
              <StatusBar style={isDark ? 'light' : 'dark'} />
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
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="profile" options={{ headerShown: false }} />
                <Stack.Screen
                  name="notifications"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
              </Stack>
            </View>
          </AuthGate>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
