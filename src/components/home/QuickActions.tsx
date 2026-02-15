/**
 * QuickActions Component
 * 2x2 grid of quick action buttons
 *
 * Design Reference: HomeScreen.png - "QUICK ACTIONS" section
 * Shows: Add Trick, Find Spot, Open Trickipedia, The Feed
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { colors as brandColors } from '@/constants/colors';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

interface QuickAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  iconColor?: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
  title?: string;
}

export function QuickActions({ actions, title = 'Quick Actions' }: QuickActionsProps) {
  const { theme, isDark } = useThemeContext();

  // Use dark amber for icons in light mode for better contrast
  const iconColor = isDark ? brandColors.primary : brandColors.primaryText;

  return (
    <Card style={styles.card} padding="md">
      <SectionHeader title={title} uppercase />

      <View style={styles.grid}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: pressed ? theme.surfaceElevated : theme.surface,
              },
            ]}
            onPress={action.onPress}
          >
            <Ionicons name={action.icon} size={24} color={action.iconColor || iconColor} />
            <Text style={[styles.actionLabel, { color: theme.text }]} numberOfLines={2}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

/**
 * QuickActionButton - Standalone action button
 */
interface QuickActionButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  iconColor?: string;
}

export function QuickActionButton({ label, icon, onPress, iconColor }: QuickActionButtonProps) {
  const { theme, isDark } = useThemeContext();

  // Use dark amber for icons in light mode for better contrast
  const defaultIconColor = isDark ? brandColors.primary : brandColors.primaryText;
  const finalIconColor = iconColor || defaultIconColor;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.standaloneButton,
        {
          backgroundColor: pressed ? theme.surfaceElevated : theme.surface,
        },
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${finalIconColor}20` }]}>
        <Ionicons name={icon} size={24} color={finalIconColor} />
      </View>
      <Text style={[styles.actionLabel, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
  },
  standaloneButton: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});

export default QuickActions;
