/**
 * Settings Screen
 * Clean, minimal settings list matching SettingsScreen.png design
 *
 * Layout:
 * - Header: Back arrow + "Settings" title
 * - List items: Account, Notifications, Privacy, Theme, Language, Help & Support
 * - Footer: Log Out button + version
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsDivider, SettingsItem } from '@/components/ui';
import { LANGUAGE_OPTIONS } from '@/lib/i18n/languages';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import { useLanguageStore } from '@/lib/stores/languageStore';

export default function SettingsScreen() {
  const { theme } = useThemeContext();
  const { t } = useTranslation();
  const { logout } = useAuthStore();
  const { preference } = useLanguageStore();

  // Current language shown in its own language ("Español", "日本語", …)
  const currentLanguage =
    preference === 'system'
      ? t('language.systemDefault')
      : (LANGUAGE_OPTIONS.find((option) => option.code === preference)?.nativeName ?? preference);

  const handleLogout = () => {
    Alert.alert(t('settings.logOutConfirmTitle'), t('settings.logOutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logOut'),
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
      <Text style={[styles.title, { color: theme.text }]}>{t('settings.title')}</Text>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Account */}
        <SettingsItem
          variant="navigation"
          icon="person-circle-outline"
          label={t('settings.account')}
          onPress={() => router.push('/profile/account')}
        />
        <SettingsDivider />

        {/* Notifications */}
        <SettingsItem
          variant="navigation"
          icon="notifications-outline"
          label={t('settings.notifications')}
          onPress={() => router.push('/profile/notifications')}
        />
        <SettingsDivider />

        {/* Privacy */}
        <SettingsItem
          variant="navigation"
          icon="lock-closed-outline"
          label={t('settings.privacy')}
          onPress={() => router.push('/profile/privacy')}
        />
        <SettingsDivider />

        {/* Theme */}
        <SettingsItem
          variant="navigation"
          icon="contrast-outline"
          label={t('settings.theme')}
          onPress={() => router.push('/profile/theme')}
        />
        <SettingsDivider />

        {/* Language */}
        <SettingsItem
          variant="value"
          icon="language-outline"
          label={t('settings.language')}
          value={currentLanguage}
          onPress={() => router.push('/profile/language')}
        />
        <SettingsDivider />

        {/* Help & Support */}
        <SettingsItem
          variant="navigation"
          icon="help-circle-outline"
          label={t('settings.helpSupport')}
          onPress={() => router.push('/profile/support')}
        />
        <SettingsDivider />

        {/* Log Out */}
        <SettingsItem
          variant="destructive"
          icon="log-out-outline"
          label={t('settings.logOut')}
          onPress={handleLogout}
        />

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: theme.textTertiary }]}>
            {t('settings.version', { version: '2.0.0' })}
          </Text>
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
