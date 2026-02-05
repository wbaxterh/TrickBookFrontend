/**
 * StatusBadge Component
 * Displays trick status: Not Started, Learning, Landed, Mastered
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrickStatus, STATUS_COLORS } from '@/types/trickbook';

interface StatusBadgeProps {
  status: TrickStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const backgroundColor = STATUS_COLORS[status];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        isSmall && styles.containerSmall,
      ]}
    >
      <Text
        style={[
          styles.text,
          isSmall && styles.textSmall,
          // Use dark text for light backgrounds (Mastered/gold)
          status === 'Mastered' && { color: '#000000' },
        ]}
      >
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  containerSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 11,
  },
});

export default StatusBadge;
