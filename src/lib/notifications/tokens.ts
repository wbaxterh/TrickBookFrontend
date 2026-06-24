/**
 * Expo push token acquisition + backend registration.
 *
 * Reads the EAS project id from the running config so getExpoPushTokenAsync
 * works in both dev and prod builds.
 *
 * Spec: docs/features/notifications.md §6.1, §7.1, §7.2
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { deletePushToken, registerPushToken } from '@/lib/api/notifications';
import { ensureAndroidChannels } from './channels';

const LAST_TOKEN_KEY = 'notifications.lastRegisteredToken';

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as any).easConfig?.projectId ||
    undefined
  );
}

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function getLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  } catch {
    return 'en-US';
  }
}

export async function getExpoTokenForThisDevice(): Promise<string | null> {
  if (!Device.isDevice) return null; // Simulators can't receive push.
  await ensureAndroidChannels();

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[notifications] EAS projectId missing — push tokens cannot be issued');
    return null;
  }

  try {
    const res = await Notifications.getExpoPushTokenAsync({ projectId });
    return res.data;
  } catch (err) {
    console.warn('[notifications] getExpoPushTokenAsync failed', err);
    return null;
  }
}

/**
 * Acquire the device's Expo token and POST it to the backend. Idempotent —
 * caches the last token locally so we skip the network when nothing changed.
 */
export async function registerThisDeviceToken(): Promise<string | null> {
  const token = await getExpoTokenForThisDevice();
  if (!token) return null;

  const last = await SecureStore.getItemAsync(LAST_TOKEN_KEY).catch(() => null);
  if (last === token) return token; // Already registered.

  try {
    await registerPushToken({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
      transport: 'expo',
      appVersion: Constants.expoConfig?.version || null,
      deviceModel: Device.modelName || null,
      timezone: getTimezone(),
      locale: getLocale(),
    });
    await SecureStore.setItemAsync(LAST_TOKEN_KEY, token).catch(() => {});
    return token;
  } catch (err) {
    console.warn('[notifications] registerPushToken failed', err);
    return null;
  }
}

/**
 * On logout — remove this device's token server-side so a future user doesn't
 * receive notifications meant for the prior account.
 */
export async function unregisterThisDeviceToken() {
  const last = await SecureStore.getItemAsync(LAST_TOKEN_KEY).catch(() => null);
  if (!last) return;
  await deletePushToken(last).catch(() => {});
  await SecureStore.deleteItemAsync(LAST_TOKEN_KEY).catch(() => {});
}
