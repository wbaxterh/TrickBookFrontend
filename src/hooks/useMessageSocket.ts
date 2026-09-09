/**
 * useMessageSocket — subscribe to real-time messaging events.
 *
 * Used by the inbox (no conversationId: just react to incoming messages / read
 * receipts to keep the list live) and by a thread (with conversationId: also
 * joins that room for typing + live messages). Handlers are read through a ref
 * so callers can pass inline closures without re-subscribing every render.
 */

import { useEffect, useRef } from 'react';
import type { Conversation, Message } from '@/lib/api/messages';
import { ensureSocket, joinConversation, leaveConversation } from '@/lib/realtime/socket';
import { useAuthStore } from '@/lib/stores/authStore';

export interface NewMessagePayload {
  message: Message;
  conversation?: Partial<Conversation> & { _id: string };
}

export interface MessageSocketHandlers {
  /** When set, this conversation's room is joined for typing + live updates. */
  conversationId?: string;
  onNewMessage?: (payload: NewMessagePayload) => void;
  onMessagesRead?: (payload: { conversationId: string; readBy: string }) => void;
  onTyping?: (payload: { conversationId: string; userId: string; typing: boolean }) => void;
  /** A group was renamed / members changed. */
  onConversationUpdated?: (payload: { conversationId: string }) => void;
}

export function useMessageSocket(handlers: MessageSocketHandlers) {
  const token = useAuthStore((s) => s.token);
  const { conversationId } = handlers;

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Event listeners — resubscribe only when the auth token changes.
  useEffect(() => {
    const socket = ensureSocket(token);
    if (!socket) return;

    const onNew = (p: NewMessagePayload) => handlersRef.current.onNewMessage?.(p);
    const onRead = (p: { conversationId: string; readBy: string }) =>
      handlersRef.current.onMessagesRead?.(p);
    const onTypingStart = (p: { conversationId: string; userId: string }) =>
      handlersRef.current.onTyping?.({ ...p, typing: true });
    const onTypingStop = (p: { conversationId: string; userId: string }) =>
      handlersRef.current.onTyping?.({ ...p, typing: false });
    const onUpdated = (p: { conversationId: string }) =>
      handlersRef.current.onConversationUpdated?.(p);

    socket.on('message:new', onNew);
    socket.on('messages:read', onRead);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('conversation:updated', onUpdated);

    return () => {
      socket.off('message:new', onNew);
      socket.off('messages:read', onRead);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('conversation:updated', onUpdated);
    };
  }, [token]);

  // Join/leave the specific conversation room (re-join after reconnects).
  useEffect(() => {
    if (!conversationId) return;
    const socket = ensureSocket(token);
    if (!socket) return;

    const join = () => joinConversation(conversationId);
    join();
    socket.on('connect', join);

    return () => {
      socket.off('connect', join);
      leaveConversation(conversationId);
    };
  }, [conversationId, token]);
}
