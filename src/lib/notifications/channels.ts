/**
 * Android notification channels.
 *
 * MUST be created BEFORE getDevicePushTokenAsync() / getExpoPushTokenAsync() is
 * called, otherwise the OS permission prompt won't appear at all.
 *
 * Spec: docs/features/notifications.md §7.2
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const CHANNELS = {
  messages: 'messages',
  reminders: 'reminders',
  homies: 'homies',
} as const;

export async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNELS.messages, {
    name: 'Direct Messages',
    description: 'Notifications for new direct messages from your homies.',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
    lightColor: '#FCF150',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });

  await Notifications.setNotificationChannelAsync(CHANNELS.reminders, {
    name: 'Trick Reminders',
    description: 'Reminders to land tricks on your lists.',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    enableVibrate: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });

  await Notifications.setNotificationChannelAsync(CHANNELS.homies, {
    name: 'Homie Requests',
    description: 'Notifications when someone sends you a homie request.',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
    lightColor: '#FCF150',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}
