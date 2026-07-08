/**
 * Homies API
 * Functions for managing homies (friends) relationships
 */

import { ENDPOINTS } from '@/constants/api';
import { apiClient } from './client';

// Types
export interface Homie {
  _id: string;
  name: string;
  email?: string;
  username?: string;
  bio?: string;
  imageUri?: string | null;
  sports?: string[];
  network?: boolean;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface HomieRequest {
  from: string;
  sentAt: string;
  user?: Homie;
}

export interface PendingRequests {
  received: HomieRequest[];
  sent: string[];
}

export interface NetworkStatus {
  discoverable: boolean;
  homiesCount: number;
  pendingRequestsCount: number;
}

export type HomieStatus = 'homies' | 'pending' | 'received' | 'none';

/**
 * Get user's network status (discoverable, counts)
 */
export async function getNetworkStatus(): Promise<NetworkStatus | null> {
  try {
    const response = await apiClient.get<NetworkStatus>(ENDPOINTS.homies.networkStatus);
    return response;
  } catch (_error) {
    return null;
  }
}

/**
 * Toggle network visibility (discoverable by others)
 */
export async function toggleNetwork(userId: string, enabled: boolean): Promise<boolean> {
  try {
    await apiClient.put(ENDPOINTS.homies.toggleNetwork(userId), { network: enabled });
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Get list of discoverable users (for Find tab)
 */
export async function getDiscoverableUsers(): Promise<Homie[]> {
  try {
    const response = await apiClient.get<Homie[]>(ENDPOINTS.homies.discoverable);
    return response;
  } catch (_error) {
    return [];
  }
}

/**
 * Search discoverable users with pagination
 */
export interface PaginatedUsersResponse {
  users: Homie[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}

export async function searchDiscoverableUsers(
  query: string = '',
  page: number = 1,
  limit: number = 20,
): Promise<PaginatedUsersResponse> {
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (query) params.append('q', query);
    const response = await apiClient.get<PaginatedUsersResponse | Homie[]>(
      `${ENDPOINTS.homies.discoverable}?${params}`,
    );

    // Handle both old flat array and new paginated response formats
    if (Array.isArray(response)) {
      return {
        users: response,
        pagination: {
          page: 1,
          limit: response.length,
          total: response.length,
          pages: 1,
          hasMore: false,
        },
      };
    }

    return response;
  } catch (_error) {
    return { users: [], pagination: { page: 1, limit: 20, total: 0, pages: 0, hasMore: false } };
  }
}

/**
 * Get user's homies list
 */
export async function getMyHomies(): Promise<Homie[]> {
  try {
    const response = await apiClient.get<Homie[]>(ENDPOINTS.homies.list);
    return response;
  } catch (_error) {
    return [];
  }
}

/**
 * Get pending homie requests (received and sent)
 */
export async function getPendingRequests(): Promise<PendingRequests> {
  try {
    const response = await apiClient.get<PendingRequests>(ENDPOINTS.homies.requests);
    return response;
  } catch (_error) {
    return { received: [], sent: [] };
  }
}

/**
 * Send a homie request to another user
 */
export async function sendHomieRequest(targetUserId: string): Promise<boolean> {
  try {
    await apiClient.post(ENDPOINTS.homies.sendRequest(targetUserId), {});
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Accept a homie request
 */
export async function acceptHomieRequest(requesterId: string): Promise<boolean> {
  try {
    await apiClient.post(ENDPOINTS.homies.accept(requesterId), {});
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Reject a homie request
 */
export async function rejectHomieRequest(requesterId: string): Promise<boolean> {
  try {
    await apiClient.post(ENDPOINTS.homies.reject(requesterId), {});
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Remove a homie
 */
export async function removeHomie(homieId: string): Promise<boolean> {
  try {
    await apiClient.delete(ENDPOINTS.homies.remove(homieId));
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Check homie status with a specific user
 */
export async function getHomieStatus(targetId: string): Promise<HomieStatus> {
  try {
    const response = await apiClient.get<{ status: HomieStatus }>(
      ENDPOINTS.homies.status(targetId),
    );
    return response.status;
  } catch (_error) {
    return 'none';
  }
}
