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
import { getOsPermission } from './permissions';
import { syncLocalReminders } from './scheduledLocal';
import { registerThisDeviceToken } from './tokens';

let _bootstrapped = false;

export async function bootstrapNotifications() {
  if (_bootstrapped) return;
  _bootstrapped = true;

  installNotificationHandlers();
  await ensureAndroidChannels();

  // If the OS already granted permission (returning user, granted in Settings,
  // or accepted the prompt on a previous launch), register the token + sync
  // the next 14d of reminder local notifications.
  const os = await getOsPermission();
  if (os === 'granted' || os === 'provisional') {
    await registerThisDeviceToken();
    syncLocalReminders().catch(() => {});
  }
}

export function _resetBootstrap() {
  _bootstrapped = false;
}
