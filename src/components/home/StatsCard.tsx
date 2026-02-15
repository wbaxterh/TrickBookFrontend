/**
 * StatsCard Component
 * Displays progress statistics with large numbers
 *
 * Design Reference: HomeScreen.png - "PROGRESS STATS" section
 * Shows: "Total Landed: 142", "This Month: 12"
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { formatNumber } from '@/lib/utils';

interface StatItem {
  label: string;
  value: number;
}

interface StatsCardProps {
  stats: StatItem[];
  title?: string;
}

export function StatsCard({ stats, title = 'Progress Stats' }: StatsCardProps) {
  const { theme, colors } = useThemeContext();

  return (
    <Card style={styles.card} padding="md">
      <SectionHeader title={title} uppercase />

      <View style={styles.statsContainer}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}:</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatNumber(stat.value)}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/**
 * CompactStatItem - Single stat display for grids
 */
interface CompactStatItemProps {
  label: string;
  value: number;
  icon?: React.ReactNode;
}

export function CompactStatItem({ label, value, icon }: CompactStatItemProps) {
  const { theme, colors } = useThemeContext();

  return (
    <View style={styles.compactStatItem}>
      {icon && <View style={styles.compactIcon}>{icon}</View>}
      <Text style={[styles.compactValue, { color: theme.text }]}>{formatNumber(value)}</Text>
      <Text style={[styles.compactLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  statsContainer: {
    gap: 8,
  },
  statItem: {
    flexDirection: 'column',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 42,
    fontWeight: '700',
    lineHeight: 48,
  },
  compactStatItem: {
    alignItems: 'center',
    padding: 12,
  },
  compactIcon: {
    marginBottom: 4,
  },
  compactValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default StatsCard;
