/**
 * ProgressBar Component
 * Horizontal progress indicator with customizable colors
 *
 * Reference: Website progress indicator pattern
 * Uses smooth transitions and status colors
 */

import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

type ProgressBarVariant = 'default' | 'success' | 'warning' | 'error' | 'status';
type TrickStatus = 'notStarted' | 'learning' | 'landed' | 'mastered';

interface ProgressBarProps {
  progress: number; // 0-100
  variant?: ProgressBarVariant;
  status?: TrickStatus;
  height?: number;
  showBackground?: boolean;
}

export function ProgressBar({
  progress,
  variant = 'default',
  status,
  height = 6,
  showBackground = true,
}: ProgressBarProps) {
  const { theme, colors } = useThemeContext();

  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const getProgressColor = (): string => {
    // If status is provided, use status colors
    if (status) {
      switch (status) {
        case 'mastered':
          return colors.status.mastered;
        case 'landed':
          return colors.status.landed;
        case 'learning':
          return colors.status.learning;
        case 'notStarted':
        default:
          return colors.status.notStarted;
      }
    }

    // Otherwise use variant colors
    switch (variant) {
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.error;
      default:
        return colors.primary;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor: showBackground ? theme.border : 'transparent',
          borderRadius: height / 2,
        },
      ]}
    >
      <View
        style={[
          styles.progress,
          {
            width: `${clampedProgress}%`,
            backgroundColor: getProgressColor(),
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}

/**
 * SegmentedProgressBar - Shows multiple segments (e.g., for trick list progress)
 */
interface ProgressSegment {
  value: number;
  color: string;
}

interface SegmentedProgressBarProps {
  segments: ProgressSegment[];
  total: number;
  height?: number;
}

export function SegmentedProgressBar({
  segments,
  total,
  height = 6,
}: SegmentedProgressBarProps) {
  const { theme } = useThemeContext();

  return (
    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor: theme.border,
          borderRadius: height / 2,
          flexDirection: 'row',
          overflow: 'hidden',
        },
      ]}
    >
      {segments.map((segment, index) => {
        const percentage = total > 0 ? (segment.value / total) * 100 : 0;
        return (
          <View
            key={index}
            style={{
              width: `${percentage}%`,
              height: '100%',
              backgroundColor: segment.color,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
  },
});

export default ProgressBar;
