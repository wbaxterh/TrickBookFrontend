/**
 * SectionHeader Component
 * Consistent section titles with optional action button
 *
 * Matches "CURRENT GOALS", "PROGRESS STATS" style from design
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { colors as brandColors } from '@/constants/colors';

interface SectionHeaderProps {
  title: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  uppercase?: boolean;
}

export function SectionHeader({
  title,
  action,
  uppercase = true,
}: SectionHeaderProps) {
  const { theme, isDark } = useThemeContext();

  // Use dark amber for action links in light mode for better contrast
  const actionColor = isDark ? brandColors.primary : brandColors.primaryText;

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.title,
          {
            color: theme.textSecondary,
            textTransform: uppercase ? 'uppercase' : 'none',
          },
        ]}
      >
        {title}
      </Text>

      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={[styles.action, { color: actionColor }]}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  action: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default SectionHeader;
