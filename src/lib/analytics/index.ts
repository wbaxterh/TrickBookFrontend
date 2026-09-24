import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Localization from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from '@/lib/api/client';

const INSTALLATION_KEY = 'analytics.installationId';
const QUEUE_KEY = 'analytics.pendingEvents.v1';
const MAX_QUEUE = 200;
const SESSION_ID = Crypto.randomUUID();
let queueLock: Promise<void> = Promise.resolve();

export type UpdatePolicy = {
  status: 'current' | 'optional' | 'required';
  latestVersion?: string;
  minimumSupportedVersion?: string;
  title?: string;
  message?: string;
  storeUrl?: string;
  policyRevision?: number;
};

type AnalyticsEvent = {
  eventId: string;
  name: string;
  schemaVersion: number;
  occurredAt: string;
  anonymousId: string;
  installationId: string;
  sessionId: string;
  platform: 'ios' | 'android';
  appVersion: string;
  buildNumber: string;
  properties: Record<string, string | number | boolean | null | string[]>;
};

function appIdentity() {
  return {
    appVersion: Constants.expoConfig?.version || '0.0.0',
    buildNumber: Constants.nativeBuildVersion || '0',
  };
}

export async function getInstallationId(): Promise<string> {
  const stored = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (stored) return stored;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(INSTALLATION_KEY, id);
  return id;
}

async function readQueue(): Promise<AnalyticsEvent[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) || '[]');
  } catch {
    return [];
  }
}

async function writeQueue(events: AnalyticsEvent[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-MAX_QUEUE)));
}

function withQueueLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = queueLock.then(operation, operation);
  queueLock = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function flushAnalytics(): Promise<void> {
  await withQueueLock(async () => {
    const queued = await readQueue();
    if (!queued.length) return;
    try {
      await apiClient.post('/analytics/events/batch', { events: queued });
      await AsyncStorage.removeItem(QUEUE_KEY);
    } catch {
      // Keep the same idempotency keys for the next foreground retry.
    }
  });
}

export async function track(
  name: string,
  properties: AnalyticsEvent['properties'] = {},
): Promise<void> {
  const installationId = await getInstallationId();
  const identity = appIdentity();
  const event: AnalyticsEvent = {
    eventId: Crypto.randomUUID(),
    name,
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    anonymousId: installationId,
    installationId,
    sessionId: SESSION_ID,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    ...identity,
    properties,
  };
  const shouldFlush = await withQueueLock(async () => {
    const queued = await readQueue();
    await writeQueue([...queued, event]);
    return queued.length >= 4;
  });
  if (shouldFlush) await flushAnalytics();
}

export async function trackScreen(path: string) {
  await track('screen_viewed', { path });
  const segments = path.split('/').filter(Boolean);
  if (segments[0] === '(tabs)' && segments[1] === 'events' && segments[2]) {
    await track('event_viewed', { event_slug: segments[2] });
  } else if (segments[0] === '(tabs)' && segments[1] === 'spots' && segments[2]) {
    await track('spot_viewed', { spot_id: segments[2] });
  } else if (segments[0] === '(tabs)' && segments[1] === 'trickbook' && segments[2]) {
    await track('trick_viewed', { trick_id: segments[2] });
  }
}

export async function sendClientHeartbeat(): Promise<UpdatePolicy | null> {
  const installationId = await getInstallationId();
  const { appVersion, buildNumber } = appIdentity();
  const locales = Localization.getLocales();
  const calendars = Localization.getCalendars();
  try {
    const notificationPermissions = await Notifications.getPermissionsAsync();
    const response = await apiClient.post<{ updatePolicy: UpdatePolicy }>('/client/heartbeat', {
      installationId,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      appVersion,
      buildNumber,
      osVersion: String(Platform.Version),
      deviceModel: Device.modelName || null,
      locale: locales[0]?.languageTag || 'en-US',
      timezone: calendars[0]?.timeZone || 'UTC',
      notificationsEnabled: notificationPermissions.status === 'granted',
    });
    return response.updatePolicy;
  } catch {
    return null;
  }
}
