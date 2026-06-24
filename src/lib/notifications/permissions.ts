/**
 * Notification permission state + soft-ask helpers.
 *
 * Soft-ask pattern (recommended by both Apple and Google): we never trigger the
 * OS permission prompt cold. The app asks in-app first, and only fires the OS
 * prompt if the user says yes.
 *
 * Spec: docs/features/notifications.md §3.1
 */

import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const SOFT_ASK_DEFERRED_KEY = 'notifications.softAskDeferredAt';
const SOFT_ASK_COOLDOWN_DAYS = 7;

export type OsPermission = 'granted' | 'denied' | 'unknown' | 'provisional';

export async function getOsPermission(): Promise<OsPermission> {
  const { status, ios } = await Notifications.getPermissionsAsync();
  if (ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'provisional';
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'unknown';
}

export async function requestOsPermission(): Promise<OsPermission> {
  const { status, ios } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowAnnouncements: false,
    },
  });
  if (ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'provisional';
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'unknown';
}

export async function shouldShowSoftAsk(): Promise<boolean> {
  const os = await getOsPermission();
  if (os === 'granted' || os === 'provisional') return false;
  if (os === 'denied') return false; // OS-level denial — show "Open Settings" instead

  // Status is 'undetermined' on iOS / 'unknown' here — fair game, but respect cooldown.
  const deferredAtRaw = await SecureStore.getItemAsync(SOFT_ASK_DEFERRED_KEY).catch(() => null);
  if (!deferredAtRaw) return true;
  const deferredAt = Number(deferredAtRaw);
  if (!Number.isFinite(deferredAt)) return true;

  const cooldownMs = SOFT_ASK_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - deferredAt >= cooldownMs;
}

export async function markSoftAskDeferred() {
  await SecureStore.setItemAsync(SOFT_ASK_DEFERRED_KEY, String(Date.now())).catch(() => {});
}

export async function clearSoftAskDeferred() {
  await SecureStore.deleteItemAsync(SOFT_ASK_DEFERRED_KEY).catch(() => {});
}
