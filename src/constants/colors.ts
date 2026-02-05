/**
 * TrickBook Color System
 * Based on NanoBananaPro design with Gold primary color
 *
 * ============================================================================
 * THEME POLICY FOR AI AGENTS & DEVELOPERS
 * ============================================================================
 *
 * CORE PRINCIPLE: Keep the color palette minimal. Only use colors defined here.
 * NEVER introduce new color variations (like "dark gold" or "muted yellow").
 *
 * PRIMARY YELLOW (#FCF150) USAGE RULES:
 * ----------------------------------------------------------------------------
 * The yellow is our brand color. It has LOW CONTRAST on light backgrounds.
 * Follow these rules to maintain readability:
 *
 * 1. YELLOW AS BACKGROUND (Preferred for emphasis)
 *    - Use yellow background with DARK text (black/primaryText)
 *    - Example: Buttons, badges, selected pills, active tabs
 *    - Text on yellow: Always use `colors.primaryText` (#1f1f1f) or black
 *
 * 2. YELLOW FOR ICONS (Usually OK)
 *    - Small icons can use yellow in both themes (stars, small indicators)
 *    - Large icons on light backgrounds: Consider using theme.text instead
 *
 * 3. YELLOW TEXT (Use sparingly - DARK MODE ONLY)
 *    - Yellow text is ONLY acceptable on dark backgrounds
 *    - On light backgrounds: Use theme.text or theme.textSecondary instead
 *    - NEVER use yellow text on white/light gray surfaces
 *
 * 4. SELECTED/ACTIVE STATES
 *    - Dark mode: Yellow text + yellow-tinted background OK
 *    - Light mode: Yellow background + dark text, OR use theme.text with
 *      a subtle yellow background tint (e.g., backgroundColor: primary + '15')
 *
 * 5. TAGS/CHIPS
 *    - Dark mode: Yellow text on semi-transparent yellow background
 *    - Light mode: Dark text (theme.text) on semi-transparent yellow background
 *
 * QUICK REFERENCE:
 * ----------------------------------------------------------------------------
 * | Element              | Dark Mode           | Light Mode                  |
 * |---------------------|---------------------|------------------------------|
 * | Button (primary)    | Yellow bg, dark text| Yellow bg, dark text         |
 * | Selected item text  | Yellow text OK      | Use theme.text (dark)        |
 * | Rating stars        | Yellow icon         | Yellow icon (small, OK)      |
 * | Tags/badges         | Yellow text         | theme.text on yellow bg      |
 * | Active tab/pill     | Yellow bg, dark text| Yellow bg, dark text         |
 * | Accent icons        | Yellow              | Yellow (if small) or text    |
 * ----------------------------------------------------------------------------
 *
 * NEVER DO:
 * - Create new color variations (no "dark gold", "muted yellow", etc.)
 * - Use yellow text on light/white backgrounds
 * - Use colors not defined in this file
 *
 * ============================================================================
 */

export const colors = {
  // Brand (matching TrickBook website)
  primary: '#FCF150',        // TrickBook Yellow (use for filled buttons, badges)
  primaryDark: '#E3D948',    // Pressed state
  primaryLight: '#FDF580',   // Lighter variant
  primaryText: '#1f1f1f',    // Secondary brand color for text/icons on light backgrounds
  secondary: '#1f1f1f',      // TrickBook Secondary Dark
  secondaryLight: '#333333',
  accent: '#1976D2',         // Blue accent
  accentDark: '#1565C0',
  accentLight: '#42A5F5',

  // Semantic
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
  premium: '#1DA1F2',        // Verified badge blue

  // Status badges
  status: {
    notStarted: '#666666',
    learning: '#FF9800',
    landed: '#4CAF50',
    mastered: '#FCF150',
  },

  // Dark theme
  dark: {
    background: '#121212',
    surface: '#1E1E1E',
    surfaceElevated: '#2C2C2C',
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
    textTertiary: '#666666',
    border: '#333333',
    borderLight: '#444444',
  },

  // Light theme
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceElevated: '#EEEEEE',
    text: '#1A1A1A',
    textSecondary: '#666666',
    textTertiary: '#999999',
    border: '#E0E0E0',
    borderLight: '#F0F0F0',
  },

  // Common
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// Theme type
export type ThemeColors = typeof colors.dark | typeof colors.light;

// Get theme colors based on mode
export const getThemeColors = (isDark: boolean) => {
  return isDark ? colors.dark : colors.light;
};

// Brand colors export for easy access
export const brandColors = {
  primary: colors.primary,
  primaryDark: colors.primaryDark,
  primaryLight: colors.primaryLight,
  primaryText: colors.primaryText,
  secondary: colors.secondary,
  secondaryLight: colors.secondaryLight,
};

export default colors;
