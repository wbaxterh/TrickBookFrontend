/**
 * Theme Settings Screen
 * Light/Dark/System theme selection
 *
 * Users can choose:
 * - Light: Always light theme
 * - Dark: Always dark theme
 * - System: Follow device settings (default)
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui';
import { type ThemePreference, useThemeContext } from '@/lib/providers/ThemeProvider';

type ThemeOption = {
  id: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
};

const themeOptions: ThemeOption[] = [
  {
    id: 'light',
    label: 'Light',
    icon: 'sunny-outline',
    description: 'Always use light theme',
  },
  {
    id: 'dark',
    label: 'Dark',
    icon: 'moon-outline',
    description: 'Always use dark theme',
  },
  {
    id: 'system',
    label: 'System',
    icon: 'phone-portrait-outline',
    description: 'Follow device settings',
  },
];

export default function ThemeScreen() {
  const { theme, colors, isDark, themePreference, setThemePreference } = useThemeContext();

  const handleSelectTheme = (preference: ThemePreference) => {
    setThemePreference(preference);
  };

  // Get the display text for current theme
  const currentThemeLabel = isDark ? 'Dark' : 'Light';
  const currentThemeIcon = isDark ? 'moon' : 'sunny';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Theme</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Current Theme Display */}
        <View style={styles.currentSection}>
          <View style={[styles.currentBadge, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons name={currentThemeIcon} size={32} color={colors.primary} />
          </View>
          <Text style={[styles.currentLabel, { color: theme.textSecondary }]}>Current theme</Text>
          <Text style={[styles.currentValue, { color: theme.text }]}>{currentThemeLabel} Mode</Text>
        </View>

        {/* Info Card */}
        <View style={styles.cardWrapper}>
          <Card padding="lg">
            <View style={styles.infoContent}>
              <Ionicons name="information-circle-outline" size={24} color={theme.textSecondary} />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                {themePreference === 'system'
                  ? "TrickBook automatically follows your device's appearance settings. Change your system theme in your device Settings to switch between light and dark mode."
                  : `You've selected ${themePreference} mode. The app will always use ${themePreference} theme regardless of your device settings.`}
              </Text>
            </View>
          </Card>
        </View>

        {/* Theme Options */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>THEME OPTIONS</Text>

        <View style={styles.optionsContainer}>
          {themeOptions.map((option) => {
            const isSelected = themePreference === option.id;

            return (
              <Pressable
                key={option.id}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: isSelected ? colors.primary : theme.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => handleSelectTheme(option.id)}
              >
                <View
                  style={[
                    styles.optionIcon,
                    {
                      backgroundColor: isSelected ? `${colors.primary}20` : theme.surfaceElevated,
                    },
                  ]}
                >
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={isSelected ? colors.primary : theme.textSecondary}
                  />
                </View>
                <Text
                  style={[styles.optionLabel, { color: isSelected ? colors.primary : theme.text }]}
                >
                  {option.label}
                </Text>
                {isSelected && (
                  <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
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
  currentSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  currentBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  currentLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  currentValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  cardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  optionCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '700',
  },
});
