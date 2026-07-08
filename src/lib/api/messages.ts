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
  unreadCount?: {
    [userId: string]: number;
  };
  createdAt: string;
  updatedAt: string;
  // Computed for display
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
 * Get all conversations for current user
 */
export async function getConversations(): Promise<Conversation[]> {
  try {
    const response = await apiClient.get<Conversation[]>(ENDPOINTS.messages.conversations);
    return response;
  } catch (_error) {
    return [];
  }
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

/**
 * Start a new conversation with a homie
 */
export async function startConversation(targetUserId: string): Promise<Conversation | null> {
  try {
    const response = await apiClient.post<Conversation>(ENDPOINTS.messages.startConversation, {
      targetUserId,
    });
    return response;
  } catch (_error) {
    return null;
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
