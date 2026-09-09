/**
 * Messages API
 * Functions for direct messaging between homies
 */

import { ENDPOINTS } from '@/constants/api';
import { apiClient } from './client';

// Types
export type SharedContentType = 'tricklist' | 'trick' | 'spot' | 'spotlist' | 'video';

export interface SharedContentPreview {
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  sportType?: string;
}

export interface SharedContent {
  contentType: SharedContentType;
  contentId: string;
  preview?: SharedContentPreview;
}

export type RichContentType =
  | 'spot_card'
  | 'spots_list'
  | 'tricklist_card'
  | 'trick_card'
  | 'spot_draft_confirmation';

export interface RichContent {
  type: RichContentType;
  data: any;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  type?: 'text' | 'shared';
  sharedContent?: SharedContent | null;
  richContent?: RichContent;
  status: 'sent' | 'read';
  readAt?: string;
  createdAt: string;
}

export interface Participant {
  _id: string;
  name: string;
  email: string;
  imageUri?: string | null;
}

export interface Conversation {
  _id: string;
  participants: string[];
  participantDetails?: Participant[];
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: string;
  };
  // List endpoint returns the current user's count as a number; the doc itself
  // stores a per-user map. Both shapes flow through here.
  unreadCount?: number | { [userId: string]: number };
  createdAt: string;
  updatedAt: string;
  // Group chat
  isGroup?: boolean;
  groupName?: string;
  createdBy?: string;
  admins?: string[];
  // Message request (a DM from a non-homie, pending the recipient's accept)
  isRequest?: boolean;
  requestedBy?: string;
  // Computed for display (1:1 only)
  otherUser?: Participant;
}

export interface MessagesResponse {
  messages: Message[];
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  };
}

/**
 * Get conversations for the current user.
 * `active` (default) = normal inbox; `requests` = message requests from non-homies.
 */
export async function getConversations(
  filter: 'active' | 'requests' = 'active',
): Promise<Conversation[]> {
  try {
    const url =
      filter === 'requests'
        ? `${ENDPOINTS.messages.conversations}?filter=requests`
        : ENDPOINTS.messages.conversations;
    return await apiClient.get<Conversation[]>(url);
  } catch (_error) {
    return [];
  }
}

/** Message requests: DMs from non-homies awaiting your accept/decline. */
export async function getMessageRequests(): Promise<Conversation[]> {
  return getConversations('requests');
}

/** Unread count for a user, tolerant of both the list (number) and doc (map) shapes. */
export function getUnreadFor(conversation: Conversation, userId?: string): number {
  const u = conversation.unreadCount;
  if (typeof u === 'number') return u;
  if (u && userId) return u[userId] || 0;
  return 0;
}

/** Display title for a conversation (group name, or the other user's name). */
export function getConversationTitle(conversation: Conversation): string {
  if (conversation.isGroup) return conversation.groupName || 'Group';
  return conversation.otherUser?.name || 'Unknown';
}

/**
 * Get a single conversation
 */
export async function getConversation(conversationId: string): Promise<Conversation | null> {
  try {
    const response = await apiClient.get<Conversation>(
      ENDPOINTS.messages.conversation(conversationId),
    );
    return response;
  } catch (_error) {
    return null;
  }
}

export type CreateConversationParams =
  | { targetUserId: string }
  | { participantIds: string[]; groupName?: string };

/**
 * Create (or fetch) a conversation. A single `targetUserId` makes a 1:1 (which
 * comes back as a request if you aren't homies); `participantIds` + `groupName`
 * makes a group.
 */
export async function createConversation(
  params: CreateConversationParams,
): Promise<Conversation | null> {
  try {
    return await apiClient.post<Conversation>(ENDPOINTS.messages.startConversation, params);
  } catch (_error) {
    return null;
  }
}

/** Start (or fetch) a 1:1 conversation. Non-homies come back as a request. */
export async function startConversation(targetUserId: string): Promise<Conversation | null> {
  return createConversation({ targetUserId });
}

/** Create a group chat with the given homie ids. */
export async function createGroupConversation(
  participantIds: string[],
  groupName: string,
): Promise<Conversation | null> {
  return createConversation({ participantIds, groupName });
}

/** Accept a message request → promotes it to an active DM. */
export async function acceptMessageRequest(conversationId: string): Promise<boolean> {
  try {
    await apiClient.post(`${ENDPOINTS.messages.conversation(conversationId)}/accept-request`, {});
    return true;
  } catch (_error) {
    return false;
  }
}

/** Decline a message request → removes the thread. */
export async function declineMessageRequest(conversationId: string): Promise<boolean> {
  try {
    await apiClient.post(`${ENDPOINTS.messages.conversation(conversationId)}/decline-request`, {});
    return true;
  } catch (_error) {
    return false;
  }
}

/** Add homies to a group. They immediately see full message history. */
export async function addGroupMembers(
  conversationId: string,
  userIds: string[],
): Promise<Conversation | null> {
  try {
    return await apiClient.post<Conversation>(
      `${ENDPOINTS.messages.conversation(conversationId)}/members`,
      { userIds },
    );
  } catch (_error) {
    return null;
  }
}

/** Rename a group chat. */
export async function renameGroup(conversationId: string, groupName: string): Promise<boolean> {
  try {
    await apiClient.post(`${ENDPOINTS.messages.conversation(conversationId)}/rename`, {
      groupName,
    });
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Get messages in a conversation with pagination
 */
export async function getMessages(
  conversationId: string,
  params: { page?: number; limit?: number } = {},
): Promise<MessagesResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const endpoint = queryString
      ? `${ENDPOINTS.messages.messages(conversationId)}?${queryString}`
      : ENDPOINTS.messages.messages(conversationId);

    const response = await apiClient.get<MessagesResponse>(endpoint);
    return response;
  } catch (_error) {
    return { messages: [] };
  }
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(
  conversationId: string,
  content: string,
): Promise<Message | null> {
  try {
    const response = await apiClient.post<Message>(ENDPOINTS.messages.sendMessage(conversationId), {
      content,
    });
    return response;
  } catch (_error) {
    return null;
  }
}

/**
 * Mark a conversation as read
 */
export async function markAsRead(conversationId: string): Promise<boolean> {
  try {
    await apiClient.put(ENDPOINTS.messages.markRead(conversationId), {});
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Get total unread message count
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const response = await apiClient.get<{ unreadCount: number }>(ENDPOINTS.messages.unreadCount);
    return response.unreadCount || 0;
  } catch (_error) {
    return 0;
  }
}

/**
 * Get or create conversation with a user
 * This is a helper that either finds existing or starts new
 */
export async function getOrCreateConversation(targetUserId: string): Promise<Conversation | null> {
  try {
    // Try to start a conversation - backend should return existing if one exists
    return await startConversation(targetUserId);
  } catch (_error) {
    return null;
  }
}

/**
 * Send shared content to a homie
 * This creates/finds a conversation and sends the shared content as a message
 */
export async function sendSharedContent(
  targetUserId: string,
  sharedContent: SharedContent,
  optionalMessage?: string,
): Promise<{ success: boolean; conversationId?: string; message?: Message }> {
  try {
    // Get or create conversation first
    const conversation = await getOrCreateConversation(targetUserId);
    if (!conversation) {
      return { success: false };
    }

    // Send the shared content as a message
    const response = await apiClient.post<Message>(
      ENDPOINTS.messages.sendMessage(conversation._id),
      {
        content: optionalMessage || null,
        sharedContent,
      },
    );

    return {
      success: true,
      conversationId: conversation._id,
      message: response,
    };
  } catch (_error) {
    return { success: false };
  }
}

/**
 * Helper to create shared content preview for different content types
 */
export function createSharedContentPreview(
  contentType: SharedContentType,
  contentId: string,
  preview: SharedContentPreview,
): SharedContent {
  return {
    contentType,
    contentId,
    preview,
  };
}
