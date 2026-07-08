/**
 * Tabs Layout
 * Main tab navigation with 5 visible tabs: Home, TrickBook, Spots, Homies, Media
 * Profile is navigable but hidden from tab bar (accessed via profile pic on home screen)
 */

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabBarIconProps {
  focused: boolean;
  color: string;
  size: number;
  name: IconName;
  focusedName: IconName;
}

function TabBarIcon({ focused, color, size, name, focusedName }: TabBarIconProps) {
  return <Ionicons name={focused ? focusedName : name} size={size} color={color} />;
}

export default function TabsLayout() {
  const { isDark, theme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'ios' ? 28 : Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Dark mode: bright yellow | Light mode: dark amber for contrast
        tabBarActiveTintColor: isDark ? colors.primary : colors.primaryText,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: isDark ? '#000000' : theme.surface,
          borderTopColor: isDark ? '#1A1A1A' : theme.border,
          borderTopWidth: 1,
          height: (Platform.OS === 'ios' ? 60 : 56) + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              size={size}
              name="home-outline"
              focusedName="home"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trickbook"
        options={{
          title: 'TrickBook',
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              size={size}
              name="book-outline"
              focusedName="book"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="spots"
        options={{
          title: 'Spots',
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              size={size}
              name="location-outline"
              focusedName="location"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="homies"
        options={{
          title: 'Homies',
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              size={size}
              name="people-outline"
              focusedName="people"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="media"
        options={{
          title: 'Media',
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              size={size}
              name="play-circle-outline"
              focusedName="play-circle"
            />
          ),
        }}
      />
      {/* Profile is navigable but hidden from tab bar - accessed via profile pic on home screen */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
