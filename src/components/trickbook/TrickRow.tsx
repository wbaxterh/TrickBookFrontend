/**
 * TrickRow Component
 * Row item for tricks in a list with status badge
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { convertStatus, type TrickListItem, type TrickStatus } from '@/types/trickbook';
import { StatusBadge } from './StatusBadge';

interface TrickRowProps {
  trick: TrickListItem;
  onPress?: () => void;
  onStatusChange?: (status: TrickStatus) => void;
}

export function TrickRow({ trick, onPress, onStatusChange }: TrickRowProps) {
  const { theme } = useThemeContext();

  // Get the current status (use computed status or convert from legacy)
  const status: TrickStatus = trick.status || convertStatus(trick.checked);

  return (
    <Pressable style={[styles.container, { borderBottomColor: theme.border }]} onPress={onPress}>
      <View style={styles.content}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {trick.name}
        </Text>
      </View>

      <StatusBadge status={status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default TrickRow;
