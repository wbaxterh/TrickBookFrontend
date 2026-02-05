/**
 * SettingsItem Component
 * A row for settings screens with icon, label, and right accessory
 *
 * Design Reference: SettingsScreen.png
 * Supports: Navigation (chevron), Toggle (switch), Value display
 */

import React from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

type SettingsItemVariant = 'navigation' | 'toggle' | 'value' | 'action' | 'destructive';

interface BaseSettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  iconColor?: string;
}

interface NavigationItemProps extends BaseSettingsItemProps {
  variant: 'navigation';
  onPress: () => void;
}

interface ToggleItemProps extends BaseSettingsItemProps {
  variant: 'toggle';
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

interface ValueItemProps extends BaseSettingsItemProps {
  variant: 'value';
  value: string;
  onPress?: () => void;
}

interface ActionItemProps extends BaseSettingsItemProps {
  variant: 'action';
  onPress: () => void;
}

interface DestructiveItemProps extends BaseSettingsItemProps {
  variant: 'destructive';
  onPress: () => void;
}

type SettingsItemProps =
  | NavigationItemProps
  | ToggleItemProps
  | ValueItemProps
  | ActionItemProps
  | DestructiveItemProps;

export function SettingsItem(props: SettingsItemProps) {
  const { theme, colors } = useThemeContext();
  const { icon, label, description, iconColor, variant } = props;

  const isDestructive = variant === 'destructive';
  const textColor = isDestructive ? colors.error : theme.text;
  const actualIconColor = isDestructive
    ? colors.error
    : iconColor || theme.textSecondary;

  const renderRightContent = () => {
    switch (variant) {
      case 'navigation':
        return (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.textSecondary}
          />
        );

      case 'toggle':
        return (
          <Switch
            value={props.value}
            onValueChange={props.onValueChange}
            disabled={props.disabled}
            trackColor={{
              false: theme.border,
              true: colors.primary,
            }}
            thumbColor="#FFFFFF"
          />
        );

      case 'value':
        return (
          <View style={styles.valueContainer}>
            <Text style={[styles.valueText, { color: theme.textSecondary }]}>
              {props.value}
            </Text>
            {props.onPress && (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            )}
          </View>
        );

      case 'action':
      case 'destructive':
        return (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDestructive ? colors.error : theme.textSecondary}
          />
        );

      default:
        return null;
    }
  };

  const handlePress = () => {
    if ('onPress' in props && props.onPress) {
      props.onPress();
    }
  };

  const isInteractive = variant !== 'toggle' || (variant === 'toggle' && !props.disabled);

  const content = (
    <View style={styles.container}>
      <View style={styles.leftContent}>
        <Ionicons name={icon} size={22} color={actualIconColor} />
        <View style={styles.textContainer}>
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
          {description && (
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {description}
            </Text>
          )}
        </View>
      </View>
      {renderRightContent()}
    </View>
  );

  if (variant === 'toggle') {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && isInteractive && { opacity: 0.7 },
      ]}
      onPress={handlePress}
      disabled={!isInteractive}
    >
      {content}
    </Pressable>
  );
}

/**
 * SettingsDivider - Horizontal line between settings items
 */
export function SettingsDivider() {
  const { theme } = useThemeContext();

  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: theme.border, marginLeft: 54 },
      ]}
    />
  );
}

/**
 * SettingsGroup - Container for grouping related settings
 */
interface SettingsGroupProps {
  children: React.ReactNode;
  title?: string;
}

export function SettingsGroup({ children, title }: SettingsGroupProps) {
  const { theme } = useThemeContext();

  return (
    <View style={styles.group}>
      {title && (
        <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>
          {title}
        </Text>
      )}
      <View
        style={[
          styles.groupContent,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    marginLeft: 14,
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    marginTop: 2,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueText: {
    fontSize: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  group: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  groupContent: {
    borderRadius: 12,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
});

export default SettingsItem;
