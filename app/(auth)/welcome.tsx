/**
 * Welcome Screen
 * Ultra-minimal design focused on quick signup and value proposition
 * Based on UX best practices from top apps (Duolingo, Calm, TikTok)
 */

import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { appleSignIn, googleSignIn } from '@/lib/api/auth';
import { getUserCount } from '@/lib/api/user';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

// Complete auth session for web browser redirects
WebBrowser.maybeCompleteAuthSession();

// Google OAuth Client IDs - Replace with your actual client IDs from Google Cloud Console
const GOOGLE_CONFIG = {
  expoClientId: 'YOUR_EXPO_CLIENT_ID.apps.googleusercontent.com',
  iosClientId: '624774098704-r7eqvb0jc4i3or885fk3k1u3l5uqlqmd.apps.googleusercontent.com',
  androidClientId: '624774098704-a40nro8bfkcof849onrsb0uhuebpe5eh.apps.googleusercontent.com',
  webClientId: '624774098704-j2q01j9g7pj41f8poqbvkvho9f7v3mco.apps.googleusercontent.com', // Same as backend GOOGLE_CLIENT_ID
};

// Format number with K/M suffix
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M+`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(0)}K+`;
  }
  return `${count}+`;
}

export default function WelcomeScreen() {
  const { theme, colors } = useThemeContext();
  const [userCount, setUserCount] = useState<number | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const { setToken, setUser } = useAuthStore();

  // Set up Google OAuth request
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CONFIG.webClientId,
    iosClientId: GOOGLE_CONFIG.iosClientId,
    androidClientId: GOOGLE_CONFIG.androidClientId,
  });

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleSignIn(id_token);
    } else if (response?.type === 'error') {
      setIsGoogleLoading(false);
      Alert.alert('Error', 'Google sign-in failed. Please try again.');
    }
  }, [response]);

  // Send ID token to backend
  const handleGoogleSignIn = async (idToken: string) => {
    try {
      const { token, user } = await googleSignIn(idToken);
      setToken(token);
      setUser(user);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Trigger Google sign-in
  const onGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await promptAsync();
    } catch (_error) {
      setIsGoogleLoading(false);
    }
  };

  // Handle Apple sign-in
  const onAppleSignIn = async () => {
    setIsAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { token, user } = await appleSignIn(
          credential.identityToken,
          credential.fullName,
          credential.email,
        );
        setToken(token);
        setUser(user);
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error', error.message || 'Failed to sign in with Apple');
      }
    } finally {
      setIsAppleLoading(false);
    }
  };

  useEffect(() => {
    // Fetch real user count
    getUserCount()
      .then((data) => setUserCount(data.count))
      .catch(() => setUserCount(null)); // Hide if fetch fails
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.content}>
        {/* Spacer to push content down */}
        <View style={styles.topSpacer} />

        {/* Logo & Branding - Centered */}
        <View style={styles.brandingSection}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            Track your progress. Find spots.{'\n'}Connect with homies.
          </Text>

          {/* Social Proof - Only show if we have a count */}
          {userCount !== null && userCount > 0 && (
            <Text style={[styles.socialProof, { color: theme.textTertiary }]}>
              Join {formatCount(userCount)} riders
            </Text>
          )}
        </View>

        {/* Bottom Section - CTAs */}
        <View style={styles.bottomSection}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.push('/(auth)/register')}
          >
            Get Started
          </Button>

          {/* Google Sign-In Button */}
          <Pressable
            style={[
              styles.ssoButton,
              {
                backgroundColor: colors.surface,
                borderColor: theme.border,
                opacity: !request || isGoogleLoading ? 0.6 : 1,
              },
            ]}
            onPress={onGoogleSignIn}
            disabled={!request || isGoogleLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={theme.text} />
                <Text style={[styles.ssoButtonText, { color: theme.text }]}>
                  Continue with Google
                </Text>
              </>
            )}
          </Pressable>

          {/* Apple Sign-In Button - iOS only */}
          {Platform.OS === 'ios' && (
            <Pressable
              style={[
                styles.ssoButton,
                {
                  backgroundColor: '#000',
                  borderColor: '#000',
                  opacity: isAppleLoading ? 0.6 : 1,
                },
              ]}
              onPress={onAppleSignIn}
              disabled={isAppleLoading}
            >
              {isAppleLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#fff" />
                  <Text style={[styles.ssoButtonText, { color: '#fff' }]}>Continue with Apple</Text>
                </>
              )}
            </Pressable>
          )}

          <Button
            variant="outline"
            size="lg"
            fullWidth
            onPress={() => router.push('/(auth)/login')}
          >
            I already have an account
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  topSpacer: {
    flex: 0.3,
  },
  brandingSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 32,
  },
  tagline: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 16,
  },
  socialProof: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  bottomSection: {
    gap: 12,
    paddingTop: 24,
  },
  ssoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  ssoButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
