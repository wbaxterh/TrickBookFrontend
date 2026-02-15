/**
 * Settings Screen
 * Clean, minimal settings list matching SettingsScreen.png design
 *
 * Layout:
 * - Header: Back arrow + "Settings" title
 * - List items: Account, Notifications, Privacy, Theme, Help & Support
 * - Footer: Log Out button + version
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsDivider, SettingsItem } from '@/components/ui';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

export default function SettingsScreen() {
  const { theme, colors } = useThemeContext();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Account */}
        <SettingsItem
          variant="navigation"
          icon="person-circle-outline"
          label="Account"
          onPress={() => router.push('/profile/account')}
        />
        <SettingsDivider />

        {/* Notifications */}
        <SettingsItem
          variant="navigation"
          icon="notifications-outline"
          label="Notifications"
          onPress={() => router.push('/profile/notifications')}
        />
        <SettingsDivider />

        {/* Privacy */}
        <SettingsItem
          variant="navigation"
          icon="lock-closed-outline"
          label="Privacy"
          onPress={() => router.push('/profile/privacy')}
        />
        <SettingsDivider />

        {/* Theme */}
        <SettingsItem
          variant="navigation"
          icon="contrast-outline"
          label="Theme (Dark/Light)"
          onPress={() => router.push('/profile/theme')}
        />
        <SettingsDivider />

        {/* Help & Support */}
        <SettingsItem
          variant="navigation"
          icon="help-circle-outline"
          label="Help & Support"
          onPress={() => router.push('/profile/support')}
        />
        <SettingsDivider />

        {/* Log Out */}
        <SettingsItem
          variant="destructive"
          icon="log-out-outline"
          label="Log Out"
          onPress={handleLogout}
        />

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: theme.textTertiary }]}>TrickBook v2.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  versionText: {
    fontSize: 13,
  },
});
