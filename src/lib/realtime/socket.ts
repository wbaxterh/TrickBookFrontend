/**
 * Real-time messaging socket (singleton).
 *
 * Connects to the backend `/messages` Socket.IO namespace (JWT-authenticated).
 * The server auto-joins `user:<id>` from the token; we join/leave per-conversation
 * rooms for typing + live thread updates. One shared connection for the whole app
 * so inbox badges and open threads all stay live.
 *
 * Server → client: `message:new`, `messages:read`, `typing:start`, `typing:stop`.
 * Client → server: `join:conversation`, `leave:conversation`, `typing:start/stop`.
 */

import { io, type Socket } from 'socket.io-client';
import { API_CONFIG } from '@/constants/api';

let socket: Socket | null = null;
let currentToken: string | null = null;

/**
 * Ensure a live socket for the given auth token. Idempotent: reuses the existing
 * connection for the same token; reconnects if the token changed. Returns null
 * when there is no token (logged out).
 */
export function ensureSocket(token: string | null): Socket | null {
  if (!token) return null;
  if (socket && currentToken === token) return socket;

  // Token changed (or stale socket) — tear down and reconnect.
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  socket = io(`${API_CONFIG.socketUrl}/messages`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  if (__DEV__) {
    socket.on('connect', () => console.log('[socket] connected', socket?.id));
    socket.on('connect_error', (err) => console.log('[socket] connect_error', err.message));
    socket.on('disconnect', (reason) => console.log('[socket] disconnected', reason));
  }

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function closeSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentToken = null;
}

export function joinConversation(conversationId: string): void {
  socket?.emit('join:conversation', conversationId);
}

export function leaveConversation(conversationId: string): void {
  socket?.emit('leave:conversation', conversationId);
}

export function emitTyping(conversationId: string, start: boolean): void {
  socket?.emit(start ? 'typing:start' : 'typing:stop', { conversationId });
}
