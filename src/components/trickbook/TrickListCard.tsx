/**
 * TrickListCard Component
 * Card for user's trick lists
 *
 * Shows: list name, progress (X/Y Landed), gold progress bar, chevron
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { TrickList, calculateProgress } from '@/types/trickbook';

interface TrickListCardProps {
  list: TrickList;
  onPress?: () => void;
}

export function TrickListCard({ list, onPress }: TrickListCardProps) {
  const { theme, colors } = useThemeContext();

  const progress = calculateProgress(list.tricks || []);
  const progressPercent = progress.total > 0
    ? ((progress.landed + progress.mastered) / progress.total) * 100
    : 0;

  return (
    <Pressable
      style={[styles.container, { backgroundColor: theme.surface }]}
      onPress={onPress}
    >
      <View style={styles.content}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {list.name}
        </Text>
        <Text style={[styles.progress, { color: theme.textSecondary }]}>
          {progress.landed + progress.mastered}/{progress.total} Landed
        </Text>

        {/* Progress Bar */}
        <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${progressPercent}%`,
              },
            ]}
          />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  progress: {
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});

export default TrickListCard;
