/**
 * Layout Constants
 * Common dimensions and spacing values
 */

import { Dimensions, Platform, StatusBar } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const layout = {
  // Screen dimensions
  screen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  // Safe areas (approximate, use SafeAreaView for actual values)
  safeArea: {
    top: Platform.OS === 'ios' ? 47 : StatusBar.currentHeight || 0,
    bottom: Platform.OS === 'ios' ? 34 : 0,
  },

  // Spacing scale (matches Tailwind)
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },

  // Border radius
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 24,
    full: 9999,
  },

  // Component sizes
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
    '2xl': 120,
  },

  // Tab bar
  tabBar: {
    height: 60,
    iconSize: 24,
  },

  // Header
  header: {
    height: 56,
  },

  // Button sizes
  button: {
    sm: 32,
    md: 44,
    lg: 56,
  },

  // Input sizes
  input: {
    height: 48,
  },

  // Card
  card: {
    padding: 16,
    gap: 12,
  },

  // Hit slop for touch targets
  hitSlop: {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
  },
};

// Responsive breakpoints
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
};

// Check if device is small
export const isSmallDevice = SCREEN_WIDTH < 375;

// Check if device is tablet
export const isTablet = SCREEN_WIDTH >= 768;

export default layout;
