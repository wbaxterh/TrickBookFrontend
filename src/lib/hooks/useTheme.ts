/**
 * Theme Hook
 * Provides theme colors based on system color scheme
 */

import { useColorScheme } from 'react-native';
import { colors, getThemeColors, ThemeColors } from '@/constants/colors';

export interface UseThemeReturn {
  isDark: boolean;
  theme: ThemeColors;
  colors: typeof colors;
}

export function useTheme(): UseThemeReturn {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getThemeColors(isDark);

  return {
    isDark,
    theme,
    colors,
  };
}

export default useTheme;
