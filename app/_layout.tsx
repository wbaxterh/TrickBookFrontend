/**
 * Root Layout
 * Sets up providers, fonts, and navigation structure
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useRootNavigationState, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SoftAskSheet } from '@/components/notifications/SoftAskSheet';
import { colors } from '@/constants/colors';
import {
  bootstrapNotifications,
  handleColdStartTap,
  registerThisDeviceToken,
  syncLocalReminders,
} from '@/lib/notifications';
import { ThemeProvider } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
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
  const { isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [notificationsReady, setNotificationsReady] = useState(false);
  const appState = useRef(AppState.currentState);
  // Cold-start deep-link must be applied at most once per app session.
  // getLastNotificationResponseAsync() keeps returning the same tapped
  // notification, so calling it on every navigation re-pushes its URL.
  const coldStartHandledRef = useRef(false);

  // Bootstrap notifications once the user reaches an authenticated tab.
  // Soft-ask is gated on `notificationsReady` so the sheet only appears once
  // the user has actually landed inside the app.
  useEffect(() => {
    if (!isAuthenticated) return;
    const inTabs = segments[0] === '(tabs)';
    if (!inTabs) return;
    let cancelled = false;
    (async () => {
      await bootstrapNotifications();
      // Apply the cold-start deep-link only once — not on every navigation.
      if (!coldStartHandledRef.current) {
        coldStartHandledRef.current = true;
        await handleColdStartTap();
      }
      if (!cancelled) setNotificationsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, segments]);

  // Refresh the token on foreground (in case it rotated or the user reinstalled).
  useEffect(() => {
    if (!isAuthenticated) return;
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && notificationsReady) {
        registerThisDeviceToken().catch(() => {});
        // Re-sync the next 14d of reminders on each foreground so any
        // server-side cadence changes flow to the device.
        syncLocalReminders().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, notificationsReady]);

  // Load stored auth on mount (once only)
  useEffect(() => {
    useAuthStore
      .getState()
      .loadStoredAuth()
      .finally(() => setHasCheckedAuth(true));
  }, []);

  // Re-validate auth when app returns to foreground (iOS kills JS context on memory pressure)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const { isAuthenticated: authed } = useAuthStore.getState();
        if (!authed) {
          useAuthStore.getState().loadStoredAuth();
        }
      }
      appState.current = nextAppState;
    });
    return () => sub.remove();
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

  return (
    <>
      {children}
      <SoftAskSheet ready={notificationsReady && isAuthenticated} />
    </>
  );
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
                backgroundColor: isDark ? colors.dark.background : colors.light.background,
              }}
            >
              <StatusBar style={isDark ? 'light' : 'dark'} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: isDark ? colors.dark.background : colors.light.background,
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
