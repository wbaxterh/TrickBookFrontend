/**
 * Welcome Screen
 * Ultra-minimal design focused on quick signup and value proposition
 * Based on UX best practices from top apps (Duolingo, Calm, TikTok)
 */

import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
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

// Conditionally load native Google Sign-In (unavailable in Expo Go)
let GoogleSigninModule: any = null;
try {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSigninModule = mod.GoogleSignin;
  GoogleSigninModule.configure({
    iosClientId: '624774098704-r7eqvb0jc4i3or885fk3k1u3l5uqlqmd.apps.googleusercontent.com',
    webClientId: '624774098704-j2q01j9g7pj41f8poqbvkvho9f7v3mco.apps.googleusercontent.com',
  });
} catch {
  // Native module not available (Expo Go) -- Google Sign-In button will be hidden
}
const googleSignInAvailable = GoogleSigninModule != null;

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

  // Trigger native Google sign-in
  const onGoogleSignIn = async () => {
    if (!GoogleSigninModule) return;
    setIsGoogleLoading(true);
    try {
      await GoogleSigninModule.hasPlayServices();
      const response = await GoogleSigninModule.signIn();

      if (response.type === 'success' && response.data.idToken) {
        // Send ID token to backend for verification
        const { token, user } = await googleSignIn(response.data.idToken);
        setToken(token);
        setUser(user);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Google sign-in failed. Please try again.');
      }
    } catch (error: any) {
      if (error.code === 'SIGN_IN_CANCELLED') {
        // User cancelled — do nothing
      } else if (error.code === 'IN_PROGRESS') {
        // Sign-in already in progress
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        Alert.alert('Error', 'Google Play Services is not available on this device.');
      } else {
        Alert.alert('Error', error.message || 'Failed to sign in with Google');
      }
    } finally {
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

          {/* Google Sign-In Button - hidden when native module unavailable (Expo Go) */}
          {googleSignInAvailable && (
            <Pressable
              style={[
                styles.ssoButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: isGoogleLoading ? 0.6 : 1,
                },
              ]}
              onPress={onGoogleSignIn}
              disabled={isGoogleLoading}
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
          )}

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
