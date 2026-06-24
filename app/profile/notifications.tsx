/**
 * Profile → Notifications screen.
 *
 * Per-category push toggles + OS-denied banner with deep-link to system Settings.
 * Reads/writes /api/users/me/notification-preferences.
 *
 * Spec: docs/features/notifications.md §3.2
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type CadenceRow,
  getAllReminderCadences,
  getNotificationPreferences,
  type NotificationPreferences,
  patchNotificationPreferences,
  type ReminderCadence,
  setReminderCadence,
} from '@/lib/api/notifications';
import { getUserTrickLists } from '@/lib/api/trickbook';
import {
  getOsPermission,
  type OsPermission,
  registerThisDeviceToken,
  requestOsPermission,
  syncLocalReminders,
} from '@/lib/notifications';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import type { TrickList } from '@/types/trickbook';

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

export default function NotificationsScreen() {
  const { theme, isDark } = useThemeContext();
  const { user, token } = useAuthStore();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [osStatus, setOsStatus] = useState<OsPermission>('unknown');
  const [lists, setLists] = useState<TrickList[]>([]);
  const [cadenceByListId, setCadenceByListId] = useState<Record<string, CadenceRow>>({});
  const [savingListId, setSavingListId] = useState<string | null>(null);

  const refresh = async () => {
    const userId = (user as any)?.id || (user as any)?._id;
    const [p, os, listsData, cadences] = await Promise.all([
      getNotificationPreferences(),
      getOsPermission(),
      userId && token ? getUserTrickLists(userId, token).catch(() => []) : Promise.resolve([]),
      getAllReminderCadences(),
    ]);
    setPrefs(p);
    setOsStatus(os);
    setLists(listsData);
    const map: Record<string, CadenceRow> = {};
    for (const c of cadences) map[String(c.listId)] = c;
    setCadenceByListId(map);
  };

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSetCadence = async (listId: string, cadence: ReminderCadence) => {
    setSavingListId(listId);
    // Optimistic update so the UI feels snappy.
    setCadenceByListId((prev) => ({
      ...prev,
      [listId]: { ...(prev[listId] || ({} as any)), listId, cadence, pausedReason: null },
    }));
    const result = await setReminderCadence(listId, cadence);
    if (!result) {
      Alert.alert("Couldn't save", 'Please check your connection and try again.');
      // Reload the truth from the server.
      const cadences = await getAllReminderCadences();
      const map: Record<string, CadenceRow> = {};
      for (const c of cadences) map[String(c.listId)] = c;
      setCadenceByListId(map);
    } else {
      // Pull fresh local notifications matching the new plan.
      syncLocalReminders().catch(() => {});
    }
    setSavingListId(null);
  };

  const togglePush = async (category: 'messages' | 'reminders', value: boolean) => {
    if (!prefs) return;
    const next: NotificationPreferences = {
      ...prefs,
      [category]: { ...prefs[category], push: value },
    };
    setPrefs(next); // optimistic
    const saved = await patchNotificationPreferences({
      [category]: { push: value },
    } as Partial<NotificationPreferences>);
    if (!saved) {
      setPrefs(prefs); // revert
      Alert.alert("Couldn't save", 'Please check your connection and try again.');
    }
  };

  const openSettings = () => Linking.openSettings();

  const requestPermission = async () => {
    const status = await requestOsPermission();
    setOsStatus(status);
    if (status === 'granted' || status === 'provisional') {
      await registerThisDeviceToken();
    }
    const platformKey =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    await patchNotificationPreferences({ osPermission: { [platformKey]: status } as any });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      ) : !prefs ? (
        <View style={styles.loading}>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>
            Couldn't load your preferences. Pull down to retry.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {osStatus === 'denied' && (
            <View style={[styles.banner, { backgroundColor: `${YELLOW}20`, borderColor: YELLOW }]}>
              <Ionicons name="warning" size={20} color={isDark ? YELLOW : '#806D00'} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.bannerTitle, { color: theme.text }]}>
                  Notifications are off in {Platform.OS === 'ios' ? 'iOS' : 'system'} Settings
                </Text>
                <Text style={[styles.bannerBody, { color: theme.textSecondary }]}>
                  Toggle TrickBook on under {Platform.OS === 'ios' ? 'Settings' : 'App info'} →
                  Notifications to start receiving pushes.
                </Text>
                <Pressable style={styles.bannerBtn} onPress={openSettings}>
                  <Text style={[styles.bannerBtnText, { color: isDark ? YELLOW : '#806D00' }]}>
                    Open Settings →
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {osStatus === 'unknown' && (
            <View
              style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="notifications-outline" size={20} color={theme.textSecondary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.bannerTitle, { color: theme.text }]}>
                  Allow notifications to receive pushes
                </Text>
                <Pressable style={styles.bannerBtn} onPress={requestPermission}>
                  <Text style={[styles.bannerBtnText, { color: isDark ? YELLOW : '#806D00' }]}>
                    Enable →
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PUSH</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Row
              icon="chatbubble"
              label="Direct messages"
              hint="When a homie sends you a DM."
              value={prefs.messages.push}
              onChange={(v) => togglePush('messages', v)}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Row
              icon="alarm"
              label="Trick reminders"
              hint="Periodic nudges to land tricks on your lists."
              value={prefs.reminders.push}
              onChange={(v) => togglePush('reminders', v)}
              theme={theme}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>QUIET HOURS</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.quietRow}>
              <Ionicons name="moon" size={18} color={theme.textSecondary} />
              <Text style={[styles.quietText, { color: theme.text }]}>
                Reminders muted between {formatTime(prefs.quietHours.start)} and{' '}
                {formatTime(prefs.quietHours.end)}
              </Text>
            </View>
            <Text style={[styles.quietHint, { color: theme.textSecondary }]}>
              Editable in a future update. Messages always come through.
            </Text>
          </View>

          {/* Per-list reminder cadence */}
          {prefs.reminders.push && lists.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                PER-LIST CADENCE
              </Text>
              <View style={[styles.card, { backgroundColor: theme.surface }]}>
                {lists.map((list, idx) => {
                  const current = cadenceByListId[String(list._id)]?.cadence || 'off';
                  const paused = cadenceByListId[String(list._id)]?.pausedReason;
                  const isLast = idx === lists.length - 1;
                  return (
                    <View key={list._id}>
                      <View style={styles.cadenceRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[styles.cadenceListName, { color: theme.text }]}
                            numberOfLines={1}
                          >
                            {list.name}
                          </Text>
                          {paused === 'auto-60d' && (
                            <Text style={[styles.cadenceHint, { color: theme.textSecondary }]}>
                              Paused — haven't opened this list in 60+ days
                            </Text>
                          )}
                        </View>
                        <CadencePicker
                          value={current}
                          onChange={(c) => handleSetCadence(String(list._id), c)}
                          theme={theme}
                          isDark={isDark}
                          saving={savingListId === String(list._id)}
                        />
                      </View>
                      {!isLast && (
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const CADENCE_OPTIONS: { value: ReminderCadence; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'weekly', label: 'Weekly' },
  { value: '3x-week', label: '3×/wk' },
  { value: 'daily', label: 'Daily' },
];

interface CadencePickerProps {
  value: ReminderCadence;
  onChange: (c: ReminderCadence) => void;
  theme: any;
  isDark: boolean;
  saving: boolean;
}
function CadencePicker({ value, onChange, theme, isDark, saving }: CadencePickerProps) {
  return (
    <View style={styles.cadencePicker}>
      {CADENCE_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            disabled={saving}
            style={[
              styles.cadenceChip,
              {
                backgroundColor: active ? YELLOW : isDark ? '#2a2a2a' : '#f0f0f0',
                opacity: saving ? 0.5 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.cadenceChipText,
                { color: active ? DARK : theme.textSecondary, fontWeight: active ? '700' : '500' },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface RowProps {
  icon: any;
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  theme: any;
}
function Row({ icon, label, hint, value, onChange, theme }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: `${YELLOW}20` }]}>
        <Ionicons name={icon} size={18} color={'#806D00'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.rowHint, { color: theme.textSecondary }]}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: YELLOW, false: '#888' }}
        thumbColor={DARK}
      />
    </View>
  );
}

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  banner: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  bannerTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  bannerBody: { fontSize: 13, lineHeight: 18 },
  bannerBtn: { marginTop: 8 },
  bannerBtnText: { fontSize: 14, fontWeight: '600' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { borderRadius: 14, paddingHorizontal: 16, marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowHint: { fontSize: 12 },
  divider: { height: 1, marginLeft: 50 },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  quietText: { fontSize: 14, fontWeight: '500', flex: 1 },
  quietHint: { fontSize: 12, marginBottom: 14, marginLeft: 30 },
  cadenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  cadenceListName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cadenceHint: { fontSize: 11, fontStyle: 'italic' },
  cadencePicker: { flexDirection: 'row', gap: 4 },
  cadenceChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  cadenceChipText: { fontSize: 12 },
});
