/**
 * Foreground notification handler + tap deep-link handler.
 *
 * - In foreground: show banner UNLESS the user is already viewing the chat the
 *   message belongs to (suppressed → in-app indicator handles it).
 * - On tap (foreground, background, or cold start): navigate via expo-router
 *   using data.url.
 *
 * Spec: docs/features/notifications.md §3.4, US-M1, US-M2
 */

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { getCurrentConversationId } from './currentChat';

let _listenersInstalled = false;
let _receivedSub: Notifications.Subscription | null = null;
let _responseSub: Notifications.Subscription | null = null;

export function installNotificationHandlers() {
  if (_listenersInstalled) return;
  _listenersInstalled = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as
        | { category?: string; threadId?: string }
        | undefined;

      // Suppress banner for messages in the chat the user is already viewing.
      if (data?.category === 'messages' && data.threadId) {
        const current = getCurrentConversationId();
        if (current && current === data.threadId) {
          return {
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
          };
        }
      }

      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });

  _receivedSub = Notifications.addNotificationReceivedListener(() => {
    // Reserved for future analytics. Intentionally silent so logs stay quiet.
  });

  _responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as
      | { url?: string; category?: string }
      | undefined;
    if (data?.url && typeof data.url === 'string') {
      try {
        router.push(data.url as any);
      } catch (err) {
        console.warn('[notifications] deep-link failed', err);
      }
    }
  });
}

/**
 * Handle a cold-start: the app was launched by tapping a notification while
 * fully terminated. Call this once after the navigator is ready.
 */
export async function handleColdStartTap() {
  const response = await Notifications.getLastNotificationResponseAsync();
  const data = response?.notification.request.content.data as { url?: string } | undefined;
  if (data?.url && typeof data.url === 'string') {
    setTimeout(() => {
      try {
        router.push(data.url as any);
      } catch (err) {
        console.warn('[notifications] cold-start deep-link failed', err);
      }
    }, 300); // wait for first render so router state exists
  }
  // Clear the stored response so a later cold start doesn't re-apply this same
  // deep-link when the app is opened without tapping a new notification.
  Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
}

export function uninstallNotificationHandlers() {
  _receivedSub?.remove();
  _responseSub?.remove();
  _receivedSub = null;
  _responseSub = null;
  _listenersInstalled = false;
}
