/**
 * FeedCTA - Secondary call-to-action to browse the feed
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { brandColors } from '@/constants/colors';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

interface FeedCTAProps {
  onPress: () => void;
}

export function FeedCTA({ onPress }: FeedCTAProps) {
  const { theme, isDark } = useThemeContext();
  const iconColor = isDark ? brandColors.primary : brandColors.primaryText;

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Card style={[pressed && { opacity: 0.8 }]} padding="md">
          <View style={styles.row}>
            <Ionicons name="play-circle" size={24} color={iconColor} />
            <Text style={[styles.text, { color: theme.text }]}>Check out the Feed</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
});
