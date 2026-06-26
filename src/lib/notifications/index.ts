/**
 * Public surface for the notifications subsystem.
 *
 * Call `bootstrapNotifications()` once on auth success — it installs handlers,
 * ensures Android channels, and registers the device token if OS permission
 * is already granted. The first-time OS prompt is owned by the soft-ask UI.
 *
 * Spec: docs/features/notifications.md §3.1, §6.1
 */

export { CHANNELS, ensureAndroidChannels } from './channels';
export { getCurrentConversationId, setCurrentConversationId } from './currentChat';
export {
  handleColdStartTap,
  installNotificationHandlers,
  uninstallNotificationHandlers,
} from './handlers';
export {
  clearSoftAskDeferred,
  getOsPermission,
  markSoftAskDeferred,
  requestOsPermission,
  shouldShowSoftAsk,
} from './permissions';
export { clearAllLocalReminders, syncLocalReminders } from './scheduledLocal';
export {
  getExpoTokenForThisDevice,
  registerThisDeviceToken,
  unregisterThisDeviceToken,
} from './tokens';

import { ensureAndroidChannels } from './channels';
import { installNotificationHandlers } from './handlers';
import { syncLocalReminders } from './scheduledLocal';
import { registerThisDeviceToken } from './tokens';

let _bootstrapped = false;

export async function bootstrapNotifications() {
  if (_bootstrapped) {
    console.log('[notifications] bootstrap: already done this session, skipping');
    return;
  }
  _bootstrapped = true;

  console.log('[notifications] bootstrap: START');
  try {
    installNotificationHandlers();
    console.log('[notifications] bootstrap: handlers installed');

    await ensureAndroidChannels();
    console.log('[notifications] bootstrap: channels ensured');

    // Always attempt token registration — registerThisDeviceToken calls
    // requestPermissionsAsync which correctly handles "already granted" AND
    // triggers native registerForRemoteNotifications.
    const token = await registerThisDeviceToken();
    console.log('[notifications] bootstrap: registerThisDeviceToken →', token ? 'OK' : 'NO TOKEN');

    if (token) {
      syncLocalReminders().catch((e) =>
        console.warn('[notifications] sync local reminders failed:', e),
      );
    }
  } catch (err: any) {
    console.warn('[notifications] bootstrap FAILED:', err?.message || err);
  }
  console.log('[notifications] bootstrap: END');
}

export function _resetBootstrap() {
  _bootstrapped = false;
}
