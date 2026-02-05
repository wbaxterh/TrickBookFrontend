/**
 * Privacy Settings Screen
 * Profile visibility and discoverability settings
 *
 * Aligns with Website settings Preferences tab (network toggle)
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { SettingsItem, SettingsDivider, SettingsGroup } from '@/components/ui';

export default function PrivacyScreen() {
  const { theme } = useThemeContext();

  // Local state - would be synced with API
  const [discoverable, setDiscoverable] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [showSpots, setShowSpots] = useState(true);
  const [showTrickLists, setShowTrickLists] = useState(true);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Privacy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Discoverability */}
        <SettingsGroup title="Profile Visibility">
          <SettingsItem
            variant="toggle"
            icon="search-outline"
            label="Discoverable"
            description="Allow other riders to find your profile"
            value={discoverable}
            onValueChange={setDiscoverable}
          />
          <SettingsDivider />
          <SettingsItem
            variant="toggle"
            icon="pulse-outline"
            label="Show Activity"
            description="Let others see when you land tricks"
            value={showActivity}
            onValueChange={setShowActivity}
          />
        </SettingsGroup>

        {/* Content Visibility */}
        <SettingsGroup title="Content Visibility">
          <SettingsItem
            variant="toggle"
            icon="location-outline"
            label="Public Spots"
            description="Show your spots on your profile"
            value={showSpots}
            onValueChange={setShowSpots}
          />
          <SettingsDivider />
          <SettingsItem
            variant="toggle"
            icon="book-outline"
            label="Public TrickLists"
            description="Let others view your trick lists"
            value={showTrickLists}
            onValueChange={setShowTrickLists}
          />
        </SettingsGroup>

        {/* Blocked Users */}
        <SettingsGroup title="Blocking">
          <SettingsItem
            variant="navigation"
            icon="ban-outline"
            label="Blocked Users"
            onPress={() => {
              // TODO: Navigate to blocked users list
            }}
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
