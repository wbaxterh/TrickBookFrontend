/**
 * GoalCard Component
 * Displays a trick goal with status, progress bar, and update button
 *
 * Design Reference: HomeScreen.png - "CURRENT GOALS" section
 * Shows: Trick name, status badge, progress bar, "update" button
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

type TrickStatus = 'notStarted' | 'learning' | 'landed' | 'mastered';

interface GoalCardProps {
  trickName: string;
  status: TrickStatus;
  progress?: number; // 0-100, only shown for 'learning' status
  onUpdate?: () => void;
}

export function GoalCard({ trickName, status, progress = 0, onUpdate }: GoalCardProps) {
  const { theme, colors } = useThemeContext();

  const getStatusConfig = () => {
    switch (status) {
      case 'mastered':
        return { label: 'Mastered', color: colors.status.mastered };
      case 'landed':
        return { label: 'Landed!', color: colors.status.landed };
      case 'learning':
        return { label: 'Learning', color: colors.status.learning };
      default:
        return { label: 'Not Started', color: colors.status.notStarted };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <Card style={styles.card} padding="md">
      {/* Trick Name */}
      <Text style={[styles.trickName, { color: theme.text }]} numberOfLines={1}>
        {trickName}
      </Text>

      {/* Status Label */}
      <Text style={[styles.statusLabel, { color: statusConfig.color }]}>{statusConfig.label}</Text>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <ProgressBar
          progress={status === 'landed' || status === 'mastered' ? 100 : progress}
          status={status}
          height={4}
        />
      </View>

      {/* Update Button */}
      <Pressable
        style={({ pressed }) => [
          styles.updateButton,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        onPress={onUpdate}
      >
        <Text style={styles.updateButtonText}>update</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 110,
    minHeight: 130,
  },
  trickName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  progressContainer: {
    marginBottom: 12,
  },
  updateButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default GoalCard;
