/**
 * User API Functions
 * Profile, Stats, and Activity
 */

import { apiClient } from './client';
import { ENDPOINTS } from '@/constants/api';
import { User } from './auth';

// Types
export interface UserStats {
  totalLove: number;
  totalRespect: number;
  tricklistCount: number;
  postCount: number;
  spotCount: number;
  homiesCount: number;
}

export interface ActivityItem {
  type: 'post' | 'reaction' | 'comment' | 'spot';
  action: string;
  reactionType?: 'love' | 'respect';
  data: {
    _id: string;
    caption?: string;
    thumbnailUrl?: string;
    mediaType?: string;
    tricks?: string[];
    stats?: { loveCount: number; respectCount: number };
    content?: string;
    postId?: string;
    postCaption?: string;
    postThumbnail?: string;
    name?: string;
    city?: string;
    state?: string;
    userId?: string;
  };
  createdAt: string;
}

export interface UserActivityResponse {
  activities: ActivityItem[];
  total: number;
  hasMore: boolean;
}

export interface PublicProfile {
  _id: string;
  name: string;
  imageUri?: string;
  sports?: string[];
  riderProfile?: Record<string, any>;
  createdAt?: string;
  network?: boolean;
  subscription?: {
    plan: 'free' | 'premium';
    status: 'free' | 'active' | 'canceled' | 'past_due';
  };
}

export interface ProfileUpdateData {
  name?: string;
  sports?: string[];
  riderProfile?: Record<string, any>;
  imageUri?: string;
}

/**
 * Get total user count (public - for welcome screen)
 */
export async function getUserCount(): Promise<{ count: number }> {
  return apiClient.get<{ count: number }>(ENDPOINTS.user.count, { skipAuth: true });
}

/**
 * Get user profile by ID (requires auth)
 */
export async function getUserProfile(userId: string): Promise<User> {
  return apiClient.get<User>(ENDPOINTS.user.profile(userId));
}

/**
 * Get public profile (no auth required)
 */
export async function getPublicProfile(userId: string): Promise<PublicProfile> {
  return apiClient.get<PublicProfile>(ENDPOINTS.user.publicProfile(userId), { skipAuth: true });
}

/**
 * Get user stats
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  return apiClient.get<UserStats>(ENDPOINTS.user.stats(userId), { skipAuth: true });
}

/**
 * Get user activity feed
 */
export async function getUserActivity(
  userId: string,
  options?: { limit?: number; skip?: number }
): Promise<UserActivityResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.skip) params.append('skip', String(options.skip));

  const queryString = params.toString();
  const endpoint = `${ENDPOINTS.user.activity(userId)}${queryString ? `?${queryString}` : ''}`;

  return apiClient.get<UserActivityResponse>(endpoint, { skipAuth: true });
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  data: ProfileUpdateData
): Promise<{ message: string; updated: ProfileUpdateData }> {
  return apiClient.put(ENDPOINTS.user.update(userId), data);
}

/**
 * Get homie activity (activities from user's homies)
 * This combines activities from all homies for the home feed
 */
export async function getHomieActivity(
  homieIds: string[],
  limit: number = 10
): Promise<ActivityItem[]> {
  // Fetch activities from each homie and combine
  const activities: ActivityItem[] = [];

  // Limit the number of homies to fetch from for performance
  const homieSubset = homieIds.slice(0, 5);

  const promises = homieSubset.map(async (homieId) => {
    try {
      const response = await getUserActivity(homieId, { limit: 3 });
      // Add user info to each activity
      return response.activities.map((activity) => ({
        ...activity,
        userId: homieId,
      }));
    } catch {
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach((result) => activities.push(...result));

  // Sort by date and limit
  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return activities.slice(0, limit);
}
