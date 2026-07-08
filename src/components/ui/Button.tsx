/**
 * Button Component
 * Primary, secondary, ghost, and outline variants
 *
 * Reference: /components/ui/button.jsx from website
 * Primary uses gold (#FFD700) with dark text
 */

import { Ionicons } from '@expo/vector-icons';
import type React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { theme, colors } = useThemeContext();

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          bg: theme.surface,
          bgPressed: theme.surfaceElevated,
          text: theme.text,
          border: 'transparent',
        };
      case 'ghost':
        return {
          bg: 'transparent',
          bgPressed: theme.surface,
          text: theme.text,
          border: 'transparent',
        };
      case 'outline':
        return {
          bg: 'transparent',
          bgPressed: theme.surface,
          text: theme.text,
          border: theme.border,
        };
      case 'destructive':
        return {
          bg: colors.error,
          bgPressed: `${colors.error}CC`,
          text: '#FFFFFF',
          border: 'transparent',
        };
      default:
        return {
          bg: colors.primary,
          bgPressed: colors.primaryDark,
          text: '#000000',
          border: 'transparent',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { height: 32, paddingH: 12, fontSize: 13, iconSize: 16 };
      case 'lg':
        return { height: 56, paddingH: 24, fontSize: 16, iconSize: 22 };
      case 'icon':
        return { height: 40, paddingH: 0, fontSize: 14, iconSize: 20, width: 40 };
      default:
        return { height: 44, paddingH: 16, fontSize: 14, iconSize: 18 };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={(state) => [
        styles.button,
        {
          height: sizeStyles.height,
          paddingHorizontal: size === 'icon' ? 0 : sizeStyles.paddingH,
          width: size === 'icon' ? sizeStyles.width : fullWidth ? '100%' : undefined,
          backgroundColor: state.pressed ? variantStyles.bgPressed : variantStyles.bg,
          borderColor: variantStyles.border,
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: isDisabled ? 0.5 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.text} />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={sizeStyles.iconSize}
              color={variantStyles.text}
              style={children ? styles.iconLeft : undefined}
            />
          )}
          {children && (
            <Text
              style={[
                styles.text,
                {
                  color: variantStyles.text,
                  fontSize: sizeStyles.fontSize,
                },
              ]}
            >
              {children}
            </Text>
          )}
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={sizeStyles.iconSize}
              color={variantStyles.text}
              style={children ? styles.iconRight : undefined}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}

/**
 * IconButton - Simplified icon-only button
 */
interface IconButtonProps extends Omit<PressableProps, 'children'> {
  icon: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function IconButton({
  icon,
  size = 'md',
  variant = 'ghost',
  style,
  ...props
}: IconButtonProps) {
  const { theme, colors } = useThemeContext();

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { dimension: 32, iconSize: 18 };
      case 'lg':
        return { dimension: 48, iconSize: 26 };
      default:
        return { dimension: 40, iconSize: 22 };
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return { bg: colors.primary, color: '#000000' };
      case 'secondary':
        return { bg: theme.surface, color: theme.text };
      default:
        return { bg: 'transparent', color: theme.text };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  return (
    <Pressable
      style={(state) => [
        styles.iconButton,
        {
          width: sizeStyles.dimension,
          height: sizeStyles.dimension,
          borderRadius: sizeStyles.dimension / 2,
          backgroundColor: state.pressed
            ? variant === 'ghost'
              ? theme.surface
              : `${variantStyles.bg}CC`
            : variantStyles.bg,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      <Ionicons name={icon} size={sizeStyles.iconSize} color={variantStyles.color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
  iconLeft: {
    marginRight: 6,
  },
  iconRight: {
    marginLeft: 6,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Button;
