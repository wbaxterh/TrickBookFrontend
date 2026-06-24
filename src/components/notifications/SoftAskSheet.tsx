/**
 * Soft-ask sheet — in-app prompt that precedes the OS notification permission.
 *
 * Mounted from app/_layout.tsx. Shows once per cooldown window (7 days) and
 * only if the OS permission state allows it (i.e. not already granted or denied).
 *
 * Spec: docs/features/notifications.md §3.1
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { patchNotificationPreferences } from '@/lib/api/notifications';
import {
  markSoftAskDeferred,
  registerThisDeviceToken,
  requestOsPermission,
  shouldShowSoftAsk,
} from '@/lib/notifications';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

interface Props {
  /** Set true after the user has reached the home tab once. */
  ready: boolean;
}

export function SoftAskSheet({ ready }: Props) {
  const { theme, isDark } = useThemeContext();
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      if (await shouldShowSoftAsk()) setVisible(true);
    })();
  }, [ready]);

  const handleYes = async () => {
    setWorking(true);
    try {
      const status = await requestOsPermission();
      const platformKey =
        Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
      await patchNotificationPreferences({ osPermission: { [platformKey]: status } as any }).catch(
        () => {},
      );
      if (status === 'granted' || status === 'provisional') {
        await registerThisDeviceToken().catch(() => {});
      }
      await markSoftAskDeferred();
    } finally {
      setWorking(false);
      setVisible(false);
    }
  };

  const handleNo = async () => {
    setWorking(true);
    try {
      await markSoftAskDeferred();
    } finally {
      setWorking(false);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleNo}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={[styles.iconBubble, { backgroundColor: `${YELLOW}25` }]}>
            <Ionicons name="notifications" size={28} color={isDark ? YELLOW : '#806D00'} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            Get a heads-up from your homies?
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            We'll ping you for direct messages and reminders to land tricks on your lists. You can
            change this anytime in Profile → Notifications.
          </Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: YELLOW }]}
            onPress={handleYes}
            disabled={working}
          >
            <Text style={styles.primaryText}>Yes, notify me</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={handleNo} disabled={working}>
            <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 19, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: DARK },
  secondaryBtn: { paddingVertical: 10 },
  secondaryText: { fontSize: 14, fontWeight: '500' },
});
