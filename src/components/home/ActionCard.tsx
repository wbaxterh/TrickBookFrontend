/**
 * ActionCard - Primary action button for the home screen
 * Used in a row of 3 to surface the core app features
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { brandColors } from '@/constants/colors';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

interface ActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  onPress: () => void;
}

export function ActionCard({ icon, label, sublabel, onPress }: ActionCardProps) {
  const { theme, isDark } = useThemeContext();
  const iconColor = isDark ? brandColors.primary : brandColors.primaryText;
  const iconBg = isDark ? `${brandColors.primary}20` : `${brandColors.primaryText}12`;

  return (
    <Pressable style={styles.wrapper} onPress={onPress}>
      {({ pressed }) => (
        <Card style={[styles.card, pressed && { opacity: 0.8 }]} padding="md">
          <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={26} color={iconColor} />
          </View>
          <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[styles.sublabel, { color: theme.textSecondary }]} numberOfLines={1}>
            {sublabel}
          </Text>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  sublabel: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 3,
    textAlign: 'center',
  },
});
