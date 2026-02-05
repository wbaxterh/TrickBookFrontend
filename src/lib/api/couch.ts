/**
 * Couch API - "The Couch" Media Library
 * Functions for curated action sports films, documentaries, and edits
 */

import { apiClient } from './client';
import { ENDPOINTS } from '@/constants/api';

// Types matching backend schema
export interface CouchVideo {
  _id: string;
  title: string;
  description?: string;
  sportTypes: string[];
  tags?: string[];
  duration?: number; // seconds
  releaseYear?: number;
  producedBy?: string;
  riders?: string[];
  sponsors?: string[];

  // Video sources
  bunnyVideoId?: string;
  hlsUrl?: string;
  youtubeUrl?: string;
  driveFileId?: string;

  // Thumbnails
  thumbnails?: {
    small?: string;
    medium?: string;
    large?: string;
    poster?: string;
  };
  driveThumbnail?: string;

  // Status
  isPublished: boolean;
  isFeatured?: boolean;

  // Metadata
  collectionId?: string;
  order?: number;
  viewCount?: number;

  // Stats (populated by backend on detail requests)
  stats?: {
    loveCount: number;
    respectCount: number;
    commentCount: number;
    viewCount: number;
  };

  createdAt?: string;
  updatedAt?: string;
}

export interface CouchCollection {
  _id: string;
  name: string;
  description?: string;
  sportTypes?: string[];
  isPublished?: boolean;
  order?: number;
  videos?: CouchVideo[];
  createdAt?: string;
}

export interface StreamUrlResponse {
  type: 'hls' | 'drive';
  // HLS (Bunny.net) fields
  hlsUrl?: string;
  thumbnailUrl?: string;
  // Google Drive fields
  streamUrl?: string;
  embedUrl?: string;  // Use this for WebView playback
}

/**
 * Get all videos (with optional filters)
 */
export async function getVideos(params: {
  sport?: string;
  collection?: string;
  sort?: 'createdAt' | 'title' | 'releaseYear' | 'popular';
  limit?: number;
} = {}): Promise<CouchVideo[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params.sport && params.sport !== 'all') queryParams.append('sport', params.sport);
    if (params.collection) queryParams.append('collection', params.collection);
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const endpoint = queryString
      ? `${ENDPOINTS.couch.videos}?${queryString}`
      : ENDPOINTS.couch.videos;

    const response = await apiClient.get<CouchVideo[]>(endpoint, { skipAuth: true });
    return response;
  } catch (error) {
    console.error('Error getting videos:', error);
    return [];
  }
}

/**
 * Get single video details
 */
export async function getVideo(videoId: string): Promise<CouchVideo | null> {
  try {
    const response = await apiClient.get<CouchVideo>(ENDPOINTS.couch.video(videoId), { skipAuth: true });
    return response;
  } catch (error) {
    console.error('Error getting video:', error);
    return null;
  }
}

/**
 * Get video stream URL - CRITICAL for video playback
 * Returns HLS URL for Bunny.net videos or Google Drive URL for Drive videos
 */
export async function getStreamUrl(videoId: string): Promise<StreamUrlResponse | null> {
  try {
    const response = await apiClient.get<StreamUrlResponse>(ENDPOINTS.couch.stream(videoId), { skipAuth: true });
    return response;
  } catch (error) {
    console.error('Error getting stream URL:', error);
    return null;
  }
}

/**
 * Get featured video for hero section
 */
export async function getFeatured(): Promise<CouchVideo | null> {
  try {
    const response = await apiClient.get<CouchVideo>(ENDPOINTS.couch.featured, { skipAuth: true });
    return response;
  } catch (error) {
    console.error('Error getting featured:', error);
    return null;
  }
}

/**
 * Get all collections (with videos populated)
 */
export async function getCollections(sport?: string): Promise<CouchCollection[]> {
  try {
    const queryParams = new URLSearchParams();
    if (sport && sport !== 'all') queryParams.append('sport', sport);

    const queryString = queryParams.toString();
    const endpoint = queryString
      ? `${ENDPOINTS.couch.collections}?${queryString}`
      : ENDPOINTS.couch.collections;

    const response = await apiClient.get<CouchCollection[]>(endpoint, { skipAuth: true });
    return response;
  } catch (error) {
    console.error('Error getting collections:', error);
    return [];
  }
}

/**
 * Get single collection with all videos
 */
export async function getCollection(collectionId: string): Promise<CouchCollection | null> {
  try {
    const response = await apiClient.get<CouchCollection>(
      ENDPOINTS.couch.collection(collectionId),
      { skipAuth: true }
    );
    return response;
  } catch (error) {
    console.error('Error getting collection:', error);
    return null;
  }
}

/**
 * Get user's reactions on a video
 */
export async function getUserReaction(videoId: string): Promise<{ love: boolean; respect: boolean } | null> {
  try {
    const response = await apiClient.get<{ love: boolean; respect: boolean }>(
      ENDPOINTS.couch.reaction(videoId)
    );
    return response;
  } catch (error) {
    console.error('Error getting user reaction:', error);
    return null;
  }
}

/**
 * Add reaction to a video
 */
export async function addReaction(videoId: string, type: 'love' | 'respect'): Promise<boolean> {
  try {
    await apiClient.post(ENDPOINTS.couch.reaction(videoId), { type });
    return true;
  } catch (error) {
    console.error('Error adding reaction:', error);
    return false;
  }
}

/**
 * Remove reaction from a video
 */
export async function removeReaction(videoId: string, type: 'love' | 'respect'): Promise<boolean> {
  try {
    await apiClient.delete(ENDPOINTS.couch.removeReaction(videoId, type));
    return true;
  } catch (error) {
    console.error('Error removing reaction:', error);
    return false;
  }
}

/**
 * Get comments for a video
 */
export interface CouchComment {
  _id: string;
  videoId: string;
  userId: string;
  content: string;
  parentCommentId?: string;
  user?: {
    name: string;
    imageUri?: string;
  };
  createdAt: string;
}

export async function getComments(videoId: string, params: {
  page?: number;
  limit?: number;
} = {}): Promise<{ comments: CouchComment[]; pagination: { page: number; limit: number; total: number; hasMore: boolean } }> {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const endpoint = queryString
      ? `${ENDPOINTS.couch.comments(videoId)}?${queryString}`
      : ENDPOINTS.couch.comments(videoId);

    const response = await apiClient.get<{ comments: CouchComment[]; pagination: { page: number; limit: number; total: number; hasMore: boolean } }>(
      endpoint,
      { skipAuth: true }
    );
    return response;
  } catch (error) {
    console.error('Error getting comments:', error);
    return { comments: [], pagination: { page: 1, limit: 20, total: 0, hasMore: false } };
  }
}

/**
 * Add comment to a video
 */
export async function addComment(videoId: string, content: string, parentCommentId?: string): Promise<CouchComment | null> {
  try {
    const response = await apiClient.post<CouchComment>(
      ENDPOINTS.couch.comments(videoId),
      { content, parentCommentId }
    );
    return response;
  } catch (error) {
    console.error('Error adding comment:', error);
    return null;
  }
}

// Helper functions

/**
 * Get the best thumbnail URL for a video
 */
export function getThumbnailUrl(video: CouchVideo): string | undefined {
  // Priority: poster > large > medium > small > driveThumbnail
  if (video.thumbnails?.poster) return video.thumbnails.poster;
  if (video.thumbnails?.large) return video.thumbnails.large;
  if (video.thumbnails?.medium) return video.thumbnails.medium;
  if (video.thumbnails?.small) return video.thumbnails.small;
  if (video.driveThumbnail) return video.driveThumbnail;
  return undefined;
}

/**
 * Format duration from seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds?: number): string {
  if (!seconds) return '';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
