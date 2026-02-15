/**
 * ActivityCard Component
 * Displays homie activity in horizontal scroll
 *
 * Design Reference: HomeScreen.png - "HOMIE ACTIVITY" section
 * Shows: Avatar + "Clark D. landed a Kickflip!"
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { formatTimeAgo } from '@/lib/utils';

type ActivityType = 'landed' | 'mastered' | 'added' | 'session' | 'spot';

interface ActivityCardProps {
  user: {
    id: string;
    name: string;
    imageUri?: string | null;
    isVerified?: boolean;
  };
  activityType: ActivityType;
  subject: string; // e.g., "Kickflip", "Brooklyn Banks"
  timestamp?: Date | string;
  onPress?: () => void;
}

export function ActivityCard({
  user,
  activityType,
  subject,
  timestamp,
  onPress,
}: ActivityCardProps) {
  const { theme, colors } = useThemeContext();

  const getActivityText = () => {
    switch (activityType) {
      case 'landed':
        return `landed a ${subject}!`;
      case 'mastered':
        return `mastered ${subject}!`;
      case 'added':
        return `added ${subject}`;
      case 'session':
        return `had a session at ${subject}`;
      case 'spot':
        return `discovered ${subject}`;
      default:
        return subject;
    }
  };

  // Get first name for compact display
  const userName = user.name || 'Homie';
  const firstName = userName.split(' ')[0];
  const lastInitial = userName.split(' ')[1]?.[0];
  const displayName = lastInitial ? `${firstName} ${lastInitial}.` : firstName;

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card} padding="md">
        <Avatar size="lg" imageUri={user.imageUri} name={userName} isVerified={user.isVerified} />

        <View style={styles.textContainer}>
          <Text style={[styles.activityText, { color: theme.text }]}>
            <Text style={styles.userName}>{displayName}</Text> {getActivityText()}
          </Text>

          {timestamp && (
            <Text style={[styles.timestamp, { color: theme.textTertiary }]}>
              {formatTimeAgo(timestamp)}
            </Text>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

/**
 * CompactActivityCard - Even smaller version for tight spaces
 */
interface CompactActivityCardProps {
  user: {
    name: string;
    imageUri?: string | null;
  };
  text: string;
  onPress?: () => void;
}

export function CompactActivityCard({ user, text, onPress }: CompactActivityCardProps) {
  const { theme } = useThemeContext();
  const userName = user.name || 'Homie';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.compactCard,
        {
          backgroundColor: theme.surface,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      onPress={onPress}
    >
      <Avatar size="md" imageUri={user.imageUri} name={userName} />
      <Text style={[styles.compactText, { color: theme.text }]} numberOfLines={2}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    alignItems: 'center',
  },
  textContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  activityText: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 18,
  },
  userName: {
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    minWidth: 180,
  },
  compactText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default ActivityCard;
