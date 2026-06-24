/**
 * Tracks the conversationId the user is currently viewing so the foreground
 * notification handler can suppress the OS banner for messages they're
 * literally looking at.
 *
 * Spec: docs/features/notifications.md §3.4, US-M2
 */

let _conversationId: string | null = null;

export function setCurrentConversationId(id: string | null) {
  _conversationId = id;
}

export function getCurrentConversationId(): string | null {
  return _conversationId;
}
