/**
 * Account Settings Screen
 * Profile info, subscription, and account management
 *
 * Aligns with Website settings Profile/Billing tabs
 */

import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  Avatar,
  Button,
  Card,
  SettingsItem,
  SettingsDivider,
  SettingsGroup,
} from '@/components/ui';

export default function AccountScreen() {
  const { theme, colors } = useThemeContext();
  const { user } = useAuthStore();

  const isPremium = user?.subscription?.plan === 'premium';

  const handleUpgrade = () => {
    // TODO: Navigate to Stripe checkout
    Alert.alert(
      'Upgrade to TrickBook Plus',
      'Unlimited spots, lists, and a verified badge for $10/month',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => {} },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement account deletion
          },
        },
      ]
    );
  };

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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <Avatar
            size="xl"
            imageUri={user?.imageUri}
            name={user?.name}
            emoji="🛹"
            isVerified={isPremium}
          />
          <Text style={[styles.userName, { color: theme.text }]}>
            {user?.name || 'Rider'}
          </Text>
          <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
            {user?.email || 'email@example.com'}
          </Text>
          <Button
            variant="outline"
            size="sm"
            icon="pencil"
            onPress={() => router.push('/profile/edit')}
          >
            Edit Profile
          </Button>
        </View>

        {/* Subscription Section */}
        <SettingsGroup title="Subscription">
          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionInfo}>
                <Ionicons
                  name={isPremium ? 'checkmark-circle' : 'diamond-outline'}
                  size={24}
                  color={isPremium ? colors.premium : colors.primary}
                />
                <View style={styles.subscriptionText}>
                  <Text style={[styles.planName, { color: theme.text }]}>
                    {isPremium ? 'TrickBook Plus' : 'Free Plan'}
                  </Text>
                  <Text
                    style={[styles.planStatus, { color: theme.textSecondary }]}
                  >
                    {isPremium ? 'Active subscription' : 'Limited features'}
                  </Text>
                </View>
              </View>
            </View>

            {!isPremium && (
              <>
                <View
                  style={[styles.divider, { backgroundColor: theme.border }]}
                />
                <View style={styles.upgradeSection}>
                  <Text style={[styles.upgradeTitle, { color: theme.text }]}>
                    Upgrade to Plus
                  </Text>
                  <View style={styles.featureList}>
                    <FeatureItem text="Unlimited spot lists" theme={theme} colors={colors} />
                    <FeatureItem text="Unlimited spots per list" theme={theme} colors={colors} />
                    <FeatureItem text="Verified badge" theme={theme} colors={colors} />
                    <FeatureItem text="Priority support" theme={theme} colors={colors} />
                  </View>
                  <Button
                    variant="primary"
                    fullWidth
                    onPress={handleUpgrade}
                  >
                    Upgrade - $10/month
                  </Button>
                </View>
              </>
            )}

            {isPremium && (
              <>
                <View
                  style={[styles.divider, { backgroundColor: theme.border }]}
                />
                <Pressable
                  style={styles.manageButton}
                  onPress={() => {
                    // TODO: Open Stripe portal
                  }}
                >
                  <Text style={[styles.manageText, { color: colors.primary }]}>
                    Manage Subscription
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.primary}
                  />
                </Pressable>
              </>
            )}
          </View>
        </SettingsGroup>

        {/* Account Actions */}
        <SettingsGroup title="Account">
          <SettingsItem
            variant="navigation"
            icon="key-outline"
            label="Change Password"
            onPress={() => router.push('/profile/change-password')}
          />
          <SettingsDivider />
          <SettingsItem
            variant="navigation"
            icon="download-outline"
            label="Download My Data"
            onPress={() => {
              Alert.alert('Coming Soon', 'Data export will be available soon.');
            }}
          />
        </SettingsGroup>

        {/* Danger Zone */}
        <SettingsGroup title="Danger Zone">
          <SettingsItem
            variant="destructive"
            icon="trash-outline"
            label="Delete Account"
            onPress={handleDeleteAccount}
          />
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

interface FeatureItemProps {
  text: string;
  theme: any;
  colors: any;
}

function FeatureItem({ text, theme, colors }: FeatureItemProps) {
  return (
    <View style={styles.featureItem}>
      <Ionicons name="checkmark" size={16} color={colors.success} />
      <Text style={[styles.featureText, { color: theme.text }]}>{text}</Text>
    </View>
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
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  userEmail: {
    fontSize: 15,
    marginTop: 4,
    marginBottom: 16,
  },
  subscriptionCard: {
    padding: 16,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subscriptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionText: {
    marginLeft: 12,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
  },
  planStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  upgradeSection: {
    gap: 12,
  },
  upgradeTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  featureList: {
    gap: 8,
    marginBottom: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  manageText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
