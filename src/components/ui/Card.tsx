/**
 * Card Component
 * Base container component matching TrickBook Website pattern
 *
 * Reference: /components/ui/card.jsx from website
 */

import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outline';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  style,
  ...props
}: CardProps) {
  const { theme } = useThemeContext();

  const paddingValues = {
    none: 0,
    sm: 8,
    md: 16,
    lg: 24,
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'elevated':
        return theme.surfaceElevated;
      case 'outline':
        return 'transparent';
      default:
        return theme.surface;
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: variant === 'outline' ? theme.border : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
          padding: paddingValues[padding],
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

interface CardHeaderProps extends ViewProps {
  children: React.ReactNode;
}

export function CardHeader({ children, style, ...props }: CardHeaderProps) {
  return (
    <View style={[styles.cardHeader, style]} {...props}>
      {children}
    </View>
  );
}

interface CardContentProps extends ViewProps {
  children: React.ReactNode;
}

export function CardContent({ children, style, ...props }: CardContentProps) {
  return (
    <View style={[styles.cardContent, style]} {...props}>
      {children}
    </View>
  );
}

interface CardFooterProps extends ViewProps {
  children: React.ReactNode;
}

export function CardFooter({ children, style, ...props }: CardFooterProps) {
  return (
    <View style={[styles.cardFooter, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardContent: {
    // Content fills available space
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default Card;
