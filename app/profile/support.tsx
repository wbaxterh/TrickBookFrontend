/**
 * Help & Support Screen
 * FAQ, contact, legal links
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsDivider, SettingsGroup, SettingsItem } from '@/components/ui';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

const SUPPORT_EMAIL = 'support@thetrickbook.com';
const WEBSITE_URL = 'https://thetrickbook.com';
const TERMS_URL = 'https://thetrickbook.com/terms';
const PRIVACY_URL = 'https://thetrickbook.com/privacy';

export default function SupportScreen() {
  const { theme } = useThemeContext();

  const handleOpenLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      // Handle error silently
    });
  };

  const handleContactUs = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {
      // Handle error silently
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Help & Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Get Help */}
        <SettingsGroup title="Get Help">
          <SettingsItem
            variant="navigation"
            icon="help-circle-outline"
            label="Help Center"
            description="FAQs and guides"
            onPress={() => handleOpenLink(`${WEBSITE_URL}/help`)}
          />
          <SettingsDivider />
          <SettingsItem
            variant="navigation"
            icon="chatbubble-ellipses-outline"
            label="Contact Us"
            description="Email our support team"
            onPress={handleContactUs}
          />
          <SettingsDivider />
          <SettingsItem
            variant="navigation"
            icon="bug-outline"
            label="Report a Bug"
            description="Help us improve the app"
            onPress={() => handleOpenLink(`${WEBSITE_URL}/feedback`)}
          />
        </SettingsGroup>

        {/* Legal */}
        <SettingsGroup title="Legal">
          <SettingsItem
            variant="navigation"
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => handleOpenLink(TERMS_URL)}
          />
          <SettingsDivider />
          <SettingsItem
            variant="navigation"
            icon="shield-outline"
            label="Privacy Policy"
            onPress={() => handleOpenLink(PRIVACY_URL)}
          />
        </SettingsGroup>

        {/* About */}
        <SettingsGroup title="About">
          <SettingsItem
            variant="navigation"
            icon="globe-outline"
            label="Visit Website"
            onPress={() => handleOpenLink(WEBSITE_URL)}
          />
          <SettingsDivider />
          <SettingsItem
            variant="value"
            icon="information-circle-outline"
            label="App Version"
            value="2.0.0"
          />
        </SettingsGroup>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
});
