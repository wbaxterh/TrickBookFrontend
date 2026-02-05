/**
 * Avatar Component
 * User avatar with support for images, icons, and premium badge
 *
 * Reference: /components/UserAvatar.js from website
 * Supports: imageUri, emoji icons with custom bg, verified badge
 */

import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface AvatarProps {
  size?: AvatarSize;
  imageUri?: string | null;
  name?: string;
  emoji?: string;
  bgColor?: string;
  backgroundColor?: string; // alias for bgColor
  showBadge?: boolean;
  isVerified?: boolean;
}

const SIZES: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
  '2xl': 120,
};

const BADGE_SIZES: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 32,
};

const FONT_SIZES: Record<AvatarSize, number> = {
  xs: 10,
  sm: 14,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
};

export function Avatar({
  size = 'md',
  imageUri,
  name,
  emoji,
  bgColor,
  backgroundColor,
  showBadge = false,
  isVerified = false,
}: AvatarProps) {
  const { theme, colors } = useThemeContext();

  // Support both bgColor and backgroundColor props
  const avatarBgColor = bgColor || backgroundColor;

  const dimension = SIZES[size];
  const badgeSize = BADGE_SIZES[size];
  const fontSize = FONT_SIZES[size];

  // Get initials from name
  const getInitials = () => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const renderContent = () => {
    // Image
    if (imageUri) {
      return (
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.image,
            { width: dimension, height: dimension, borderRadius: dimension / 2 },
          ]}
        />
      );
    }

    // Emoji icon
    if (emoji) {
      return (
        <View
          style={[
            styles.placeholder,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
              backgroundColor: avatarBgColor || colors.primary,
            },
          ]}
        >
          <Text style={{ fontSize: fontSize * 0.8 }}>{emoji}</Text>
        </View>
      );
    }

    // Initials or default icon
    return (
      <View
        style={[
          styles.placeholder,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
            backgroundColor: avatarBgColor || colors.primary,
          },
        ]}
      >
        {name ? (
          <Text
            style={[
              styles.initials,
              { fontSize: fontSize * 0.5, color: '#000000' },
            ]}
          >
            {getInitials()}
          </Text>
        ) : (
          <Ionicons name="person" size={fontSize * 0.6} color="#000000" />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderContent()}

      {/* Verified Badge */}
      {(showBadge || isVerified) && (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: colors.premium,
              borderColor: theme.background,
              borderWidth: 2,
            },
          ]}
        >
          <Ionicons
            name="checkmark"
            size={badgeSize * 0.6}
            color="#FFFFFF"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Avatar;
