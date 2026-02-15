/**
 * Notifications Settings Screen
 * Push and email notification preferences
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsDivider, SettingsGroup, SettingsItem } from '@/components/ui';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

export default function NotificationsScreen() {
  const { theme } = useThemeContext();

  // Local state - would be synced with API
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [homieActivity, setHomieActivity] = useState(true);
  const [newFollowers, setNewFollowers] = useState(true);
  const [comments, setComments] = useState(true);
  const [likes, setLikes] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Main Toggles */}
        <SettingsGroup title="Channels">
          <SettingsItem
            variant="toggle"
            icon="notifications-outline"
            label="Push Notifications"
            description="Receive notifications on your device"
            value={pushEnabled}
            onValueChange={setPushEnabled}
          />
          <SettingsDivider />
          <SettingsItem
            variant="toggle"
            icon="mail-outline"
            label="Email Updates"
            description="Receive updates via email"
            value={emailEnabled}
            onValueChange={setEmailEnabled}
          />
        </SettingsGroup>

        {/* Activity Notifications */}
        <SettingsGroup title="Activity">
          <SettingsItem
            variant="toggle"
            icon="people-outline"
            label="Homie Activity"
            description="When your homies land tricks or add spots"
            value={homieActivity}
            onValueChange={setHomieActivity}
            disabled={!pushEnabled}
          />
          <SettingsDivider />
          <SettingsItem
            variant="toggle"
            icon="person-add-outline"
            label="New Followers"
            description="When someone follows you"
            value={newFollowers}
            onValueChange={setNewFollowers}
            disabled={!pushEnabled}
          />
          <SettingsDivider />
          <SettingsItem
            variant="toggle"
            icon="chatbubble-outline"
            label="Comments"
            description="When someone comments on your posts"
            value={comments}
            onValueChange={setComments}
            disabled={!pushEnabled}
          />
          <SettingsDivider />
          <SettingsItem
            variant="toggle"
            icon="heart-outline"
            label="Likes & Reactions"
            description="When someone reacts to your content"
            value={likes}
            onValueChange={setLikes}
            disabled={!pushEnabled}
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
