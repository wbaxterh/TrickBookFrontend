/**
 * Expo push token acquisition + backend registration.
 * Verbose by design — every step prints to Metro console so failures are diagnosable.
 * Always calls requestPermissionsAsync so iOS native registerForRemoteNotifications is invoked
 * even when permission was granted via iOS Settings (not via in-app prompt).
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { deletePushToken, registerPushToken } from '@/lib/api/notifications';
import { ensureAndroidChannels } from './channels';

const LAST_TOKEN_KEY = 'notifications.lastRegisteredToken';
const TOKEN_TIMEOUT_MS = 15000;

function log(...args: any[]) {
  console.log('[notifications]', ...args);
}

function getProjectId(): string | undefined {
  const id =
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as any).easConfig?.projectId ||
    undefined;
  log('projectId resolved →', id || '(undefined)');
  return id;
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

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export async function getExpoTokenForThisDevice(): Promise<string | null> {
  log('getExpoTokenForThisDevice() start');
  log('Device.isDevice →', Device.isDevice);
  if (!Device.isDevice) {
    log('SKIP: not a physical device, simulators cannot receive push');
    return null;
  }

  await ensureAndroidChannels();

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[notifications] EAS projectId missing — push tokens cannot be issued');
    return null;
  }

  // Always request — even if iOS Settings shows granted, the app must invoke
  // registerForRemoteNotifications (which expo-notifications does inside this call).
  log('calling requestPermissionsAsync...');
  const permRes = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  log(
    'requestPermissionsAsync →',
    JSON.stringify({
      status: permRes.status,
      granted: permRes.granted,
      canAskAgain: permRes.canAskAgain,
      ios: permRes.ios,
    }),
  );

  if (permRes.status !== 'granted') {
    log('SKIP: permission status not granted');
    return null;
  }

  log('calling getExpoPushTokenAsync...');
  try {
    const res = await withTimeout(
      Notifications.getExpoPushTokenAsync({ projectId }),
      TOKEN_TIMEOUT_MS,
      'getExpoPushTokenAsync',
    );
    log('getExpoPushTokenAsync OK → token prefix:', (res.data || '').slice(0, 30) + '...');
    return res.data;
  } catch (err: any) {
    console.warn('[notifications] getExpoPushTokenAsync FAILED:', err?.message || err);
    if (err?.message?.includes('timed out')) {
      console.warn(
        '[notifications] HINT: timeout usually = iOS refused APNs registration.\n' +
          'Most common cause: aps-environment mismatch (production on Ad Hoc build needs sandbox).\n' +
          'Plug device into Mac, open Console.app, filter "apsd", retry app launch.',
      );
    }
    return null;
  }
}

export async function registerThisDeviceToken(): Promise<string | null> {
  log('registerThisDeviceToken() start');
  const token = await getExpoTokenForThisDevice();
  if (!token) {
    log('registerThisDeviceToken: no token → bail');
    return null;
  }

  const last = await SecureStore.getItemAsync(LAST_TOKEN_KEY).catch(() => null);
  if (last === token) {
    log('registerThisDeviceToken: token unchanged since last register, skipping POST');
    return token;
  }

  log('POSTing token to backend...');
  try {
    const ok = await registerPushToken({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
      transport: 'expo',
      appVersion: Constants.expoConfig?.version || null,
      deviceModel: Device.modelName || null,
      timezone: getTimezone(),
      locale: getLocale(),
    });
    log('POST /push-tokens →', ok ? 'OK' : 'FAILED');
    if (ok) await SecureStore.setItemAsync(LAST_TOKEN_KEY, token).catch(() => {});
    return ok ? token : null;
  } catch (err: any) {
    console.warn('[notifications] registerPushToken POST failed:', err?.message || err);
    return null;
  }
}

export async function unregisterThisDeviceToken() {
  const last = await SecureStore.getItemAsync(LAST_TOKEN_KEY).catch(() => null);
  if (!last) return;
  await deletePushToken(last).catch(() => {});
  await SecureStore.deleteItemAsync(LAST_TOKEN_KEY).catch(() => {});
}
