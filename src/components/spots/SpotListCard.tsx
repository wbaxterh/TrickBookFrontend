/**
 * SpotListCard Component
 * Card for user's spot lists
 *
 * Shows: list name, spot count (X spots), chevron
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { SpotList } from '@/types/spots';

interface SpotListCardProps {
  list: SpotList;
  onPress?: () => void;
}

export function SpotListCard({ list, onPress }: SpotListCardProps) {
  const { theme } = useThemeContext();
  const spotCount = list.spotCount ?? list.spotIds?.length ?? 0;

  return (
    <Pressable
      style={[styles.container, { backgroundColor: theme.surface }]}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="location" size={24} color={theme.text} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {list.name}
        </Text>
        <Text style={[styles.count, { color: theme.textSecondary }]}>
          {spotCount} {spotCount === 1 ? 'spot' : 'spots'}
        </Text>
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
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(252, 241, 80, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  count: {
    fontSize: 14,
  },
});

export default SpotListCard;
