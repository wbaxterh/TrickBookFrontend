/**
 * Local pre-scheduling for reminder notifications.
 *
 * On app foreground we fetch the next 14 days of pending reminders from the
 * server and schedule each one as a local notification via
 * Notifications.scheduleNotificationAsync. Local notifications survive offline,
 * kill, and bad mobile-network conditions — the server-side cron is the backup
 * for everything not on this device.
 *
 * Dedup: every local notification carries the server's `idempotencyKey`. The
 * server's `reminderSender` cron also uses that key, so the two paths can't
 * fire twice for the same (user, list, fireTime) combination.
 *
 * Spec: docs/features/notifications.md §6.3
 */

import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { getUpcomingScheduledReminders, type ScheduledReminder } from '@/lib/api/notifications';

const SYNCED_KEYS_STORE = 'notifications.localReminderKeys';
const REMINDER_TAG = 'reminder';

interface SyncedKeys {
  byKey: Record<string, string>; // idempotencyKey → expo notification id
}

async function readSynced(): Promise<SyncedKeys> {
  try {
    const raw = await SecureStore.getItemAsync(SYNCED_KEYS_STORE);
    if (!raw) return { byKey: {} };
    const parsed = JSON.parse(raw);
    if (parsed?.byKey && typeof parsed.byKey === 'object') return parsed;
    return { byKey: {} };
  } catch {
    return { byKey: {} };
  }
}

async function writeSynced(s: SyncedKeys) {
  try {
    await SecureStore.setItemAsync(SYNCED_KEYS_STORE, JSON.stringify(s));
  } catch {
    /* non-fatal */
  }
}

/**
 * Fetch upcoming server-side scheduled reminders and reconcile them with
 * locally-scheduled notifications. Adds anything new, removes anything stale.
 *
 * Safe to call on every app foreground — debounce yourself if you call it
 * very frequently.
 */
export async function syncLocalReminders() {
  let upcoming: ScheduledReminder[] = [];
  try {
    upcoming = await getUpcomingScheduledReminders(14);
  } catch {
    return; // network failure — silent, server cron is the fallback
  }

  const synced = await readSynced();
  const upcomingKeys = new Set(upcoming.map((r) => r.idempotencyKey));

  // Remove anything we previously scheduled that's no longer on the server's
  // list (cancelled, replanned, sent, etc.).
  const stale = Object.keys(synced.byKey).filter((k) => !upcomingKeys.has(k));
  for (const key of stale) {
    const id = synced.byKey[key];
    if (id) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        /* may already be gone */
      }
    }
    delete synced.byKey[key];
  }

  // Add anything new. Cap to a sane number to stay well under OS limits
  // (iOS allows ~64 pending local notifications per app; we're fine).
  for (const r of upcoming) {
    if (synced.byKey[r.idempotencyKey]) continue;

    const fireAt = new Date(r.scheduledFor);
    const secondsFromNow = Math.floor((fireAt.getTime() - Date.now()) / 1000);
    if (secondsFromNow <= 0) continue; // already past — server will handle

    try {
      const id = await Notifications.scheduleNotificationAsync({
        identifier: `${REMINDER_TAG}-${r.idempotencyKey}`,
        content: {
          title: 'Time to send it 🛹',
          // Body is intentionally generic on-device because we don't know
          // which specific trick will still be unfinished when it fires.
          // The server-side push (when online) carries the trick name.
          body: "You've got tricks to land on your list — go session.",
          data: {
            category: 'reminders',
            listId: r.listId,
            idempotencyKey: r.idempotencyKey,
            url: `/(tabs)/trickbook?listId=${r.listId}&fromReminder=1`,
          },
          sound: 'default',
        },
        trigger: { seconds: secondsFromNow, channelId: 'reminders' } as any,
      });
      synced.byKey[r.idempotencyKey] = id;
    } catch (err) {
      console.warn('[notifications/local] schedule failed', err);
    }
  }

  await writeSynced(synced);
}

/**
 * Cancel every locally-scheduled reminder. Use on logout.
 */
export async function clearAllLocalReminders() {
  const synced = await readSynced();
  for (const id of Object.values(synced.byKey)) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      /* ignore */
    }
  }
  await writeSynced({ byKey: {} });
}
