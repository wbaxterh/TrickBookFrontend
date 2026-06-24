/**
 * Notifications API client.
 *
 * Talks to:
 *   POST   /api/push-tokens
 *   DELETE /api/push-tokens/:token
 *   GET    /api/users/me/notification-preferences
 *   PATCH  /api/users/me/notification-preferences
 *
 * Spec: docs/features/notifications.md §5
 */

import { apiClient } from './client';

export type OsPermissionStatus = 'granted' | 'denied' | 'unknown' | 'provisional';

export interface CategoryPreference {
  push: boolean;
  inApp: boolean;
  email: boolean;
}

export interface QuietHours {
  start: string; // 'HH:mm'
  end: string;
  timezone: string;
}

export interface NotificationPreferences {
  messages: CategoryPreference;
  reminders: CategoryPreference;
  quietHours: QuietHours;
  osPermission: { ios: OsPermissionStatus; android: OsPermissionStatus; web: OsPermissionStatus };
  updatedAt?: string;
}

export interface RegisterPushTokenInput {
  token: string;
  platform: 'ios' | 'android' | 'web';
  transport?: 'expo' | 'fcm' | 'apns' | 'webpush';
  appVersion?: string | null;
  deviceModel?: string | null;
  timezone?: string;
  locale?: string;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  try {
    const res = await apiClient.get<{ notificationPreferences: NotificationPreferences }>(
      '/users/me/notification-preferences',
    );
    return res.notificationPreferences;
  } catch (_err) {
    return null;
  }
}

export async function patchNotificationPreferences(
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences | null> {
  try {
    const res = await apiClient.patch<{ notificationPreferences: NotificationPreferences }>(
      '/users/me/notification-preferences',
      patch,
    );
    return res.notificationPreferences;
  } catch (_err) {
    return null;
  }
}

export async function registerPushToken(input: RegisterPushTokenInput): Promise<boolean> {
  try {
    await apiClient.post('/push-tokens', input);
    return true;
  } catch (_err) {
    return false;
  }
}

export async function deletePushToken(token: string): Promise<boolean> {
  try {
    await apiClient.delete(`/push-tokens/${encodeURIComponent(token)}`);
    return true;
  } catch (_err) {
    return false;
  }
}

// ─── Reminder cadence ────────────────────────────────────────────────────────

export type ReminderCadence = 'off' | 'daily' | '3x-week' | 'weekly';

export interface CadenceRow {
  _id: string;
  userId: string;
  listId: string;
  cadence: ReminderCadence;
  pausedReason: 'auto-60d' | 'user' | null;
  updatedAt?: string;
  createdAt?: string;
}

export interface ScheduledReminder {
  _id: string;
  userId: string;
  listId: string;
  category: 'reminder';
  scheduledFor: string; // ISO
  status: 'pending' | 'sent' | 'cancelled' | 'failed' | 'inflight' | 'skipped';
  idempotencyKey: string;
}

export async function getAllReminderCadences(): Promise<CadenceRow[]> {
  try {
    const res = await apiClient.get<{ cadences: CadenceRow[] }>('/users/me/reminder-cadence');
    return res.cadences || [];
  } catch (_err) {
    return [];
  }
}

export async function getReminderCadence(
  listId: string,
): Promise<{ cadence: ReminderCadence; pausedReason: string | null } | null> {
  try {
    return await apiClient.get(`/users/me/reminder-cadence/${listId}`);
  } catch (_err) {
    return null;
  }
}

export async function setReminderCadence(
  listId: string,
  cadence: ReminderCadence,
): Promise<{ cadence: ReminderCadence; planned: number } | null> {
  try {
    return await apiClient.put(`/users/me/reminder-cadence/${listId}`, { cadence });
  } catch (_err) {
    return null;
  }
}

export async function getUpcomingScheduledReminders(withinDays = 14): Promise<ScheduledReminder[]> {
  try {
    const res = await apiClient.get<{ scheduledNotifications: ScheduledReminder[] }>(
      `/users/me/reminder-cadence/scheduled-notifications?within=${withinDays}`,
    );
    return res.scheduledNotifications || [];
  } catch (_err) {
    return [];
  }
}
