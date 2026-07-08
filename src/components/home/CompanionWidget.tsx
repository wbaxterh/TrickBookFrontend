/**
 * CompanionWidget - Kaori AI companion card for the home screen
 * Shows avatar, name, and quick-launch to chat
 */

import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { brandColors } from '@/constants/colors';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

interface Bot {
  _id: string;
  name: string;
  bio?: string;
  imageUri?: string;
}

interface CompanionWidgetProps {
  bot: Bot | null;
  onPress: () => void;
  /** Optional: opens the companion's interactive 3D stage */
  onView3D?: () => void;
}

export function CompanionWidget({ bot, onPress, onView3D }: CompanionWidgetProps) {
  const { theme } = useThemeContext();

  if (!bot) return null;

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Card
          style={[
            styles.card,
            { borderLeftColor: brandColors.primary },
            pressed && { opacity: 0.8 },
          ]}
          padding="md"
        >
          <View style={styles.row}>
            <View style={styles.avatarWrapper}>
              {bot.imageUri ? (
                <Image source={{ uri: bot.imageUri }} style={styles.avatar} />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: `${brandColors.primary}30` },
                  ]}
                >
                  <Text style={styles.avatarEmoji}>🤖</Text>
                </View>
              )}
              <View style={[styles.chipBadge, { borderColor: theme.surface }]}>
                <Ionicons name="hardware-chip-outline" size={8} color={brandColors.primaryText} />
              </View>
            </View>

            <View style={styles.textContainer}>
              <Text style={[styles.name, { color: theme.text }]}>{bot.name}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Your AI companion
              </Text>
            </View>

            {onView3D && (
              <Pressable
                onPress={onView3D}
                style={[styles.stageButton, { backgroundColor: theme.surfaceElevated }]}
              >
                <Ionicons name="cube-outline" size={16} color={theme.text} />
              </Pressable>
            )}

            <View style={[styles.chatButton, { backgroundColor: brandColors.primary }]}>
              <Ionicons name="chatbubble" size={14} color={brandColors.primaryText} />
              <Text style={[styles.chatButtonText, { color: brandColors.primaryText }]}>Chat</Text>
            </View>
          </View>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 22,
  },
  chipBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FCF150',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  stageButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  chatButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
