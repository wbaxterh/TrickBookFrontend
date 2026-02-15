/**
 * Badge Component
 * Status badges, count badges, and tag chips
 *
 * Reference: /components/ui/badge.jsx from website
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'outline';
type BadgeSize = 'sm' | 'md' | 'lg';

// Trick status types matching backend
type TrickStatus = 'notStarted' | 'learning' | 'landed' | 'mastered';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

interface StatusBadgeProps {
  status: TrickStatus;
  size?: BadgeSize;
}

export function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  const { theme, colors } = useThemeContext();

  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: `${colors.success}30`, text: colors.success };
      case 'warning':
        return { bg: `${colors.warning}30`, text: colors.warning };
      case 'error':
        return { bg: `${colors.error}30`, text: colors.error };
      case 'secondary':
        return { bg: theme.surface, text: theme.textSecondary };
      case 'outline':
        return { bg: 'transparent', text: theme.text };
      default:
        return { bg: `${colors.primary}30`, text: colors.primary };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { paddingH: 6, paddingV: 2, fontSize: 10 };
      case 'lg':
        return { paddingH: 12, paddingV: 6, fontSize: 14 };
      default:
        return { paddingH: 8, paddingV: 4, fontSize: 12 };
    }
  };

  const colorStyles = getColors();
  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colorStyles.bg,
          paddingHorizontal: sizeStyles.paddingH,
          paddingVertical: sizeStyles.paddingV,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: theme.border,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: colorStyles.text,
            fontSize: sizeStyles.fontSize,
          },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * StatusBadge - Specific badge for trick status
 * Uses colors from design docs
 */
export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { colors } = useThemeContext();

  const getStatusConfig = (): { label: string; color: string } => {
    switch (status) {
      case 'mastered':
        return { label: 'Mastered', color: colors.status.mastered };
      case 'landed':
        return { label: 'Landed', color: colors.status.landed };
      case 'learning':
        return { label: 'Learning', color: colors.status.learning };
      default:
        return { label: 'Not Started', color: colors.status.notStarted };
    }
  };

  const config = getStatusConfig();

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { paddingH: 6, paddingV: 2, fontSize: 10 };
      case 'lg':
        return { paddingH: 12, paddingV: 6, fontSize: 14 };
      default:
        return { paddingH: 8, paddingV: 4, fontSize: 12 };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${config.color}30`,
          paddingHorizontal: sizeStyles.paddingH,
          paddingVertical: sizeStyles.paddingV,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: config.color,
            fontSize: sizeStyles.fontSize,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

/**
 * CountBadge - Notification count badge
 */
interface CountBadgeProps {
  count: number;
  max?: number;
}

export function CountBadge({ count, max = 99 }: CountBadgeProps) {
  const { colors } = useThemeContext();

  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <View style={[styles.countBadge, { backgroundColor: colors.error }]}>
      <Text style={styles.countText}>{displayCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default Badge;
