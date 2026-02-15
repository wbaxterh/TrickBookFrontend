/**
 * Spot Reviews API
 * Functions for managing spot reviews and ratings
 */

import { ENDPOINTS } from '@/constants/api';
import { apiClient } from './client';

// Types
export interface ReviewUser {
  _id: string;
  name: string;
  imageUri?: string;
}

export interface SpotReview {
  _id: string;
  spotId: string;
  userId: string;
  rating: number;
  content: string;
  visitDate?: string;
  tags?: string[];
  helpfulCount: number;
  status: 'active' | 'deleted';
  createdAt: string;
  updatedAt: string;
  user?: ReviewUser;
}

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface SpotReviewsResponse {
  reviews: SpotReview[];
  ratingDistribution: RatingDistribution;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}

export interface CreateReviewData {
  spotId: string;
  rating: number;
  content?: string;
  visitDate?: Date;
  tags?: string[];
}

export interface UpdateReviewData {
  rating?: number;
  content?: string;
  visitDate?: Date;
  tags?: string[];
}

/**
 * Get reviews for a spot with pagination and rating distribution
 */
export async function getSpotReviews(
  spotId: string,
  params: { page?: number; limit?: number; sort?: string } = {},
): Promise<SpotReviewsResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sort) queryParams.append('sort', params.sort);

    const queryString = queryParams.toString();
    const endpoint = queryString
      ? `${ENDPOINTS.spotReviews.bySpot(spotId)}?${queryString}`
      : ENDPOINTS.spotReviews.bySpot(spotId);

    const response = await apiClient.get<SpotReviewsResponse>(endpoint, { skipAuth: true });
    return response;
  } catch (_error) {
    return {
      reviews: [],
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
        hasMore: false,
      },
    };
  }
}

/**
 * Create a new review for a spot
 */
export async function createSpotReview(data: CreateReviewData): Promise<SpotReview | null> {
  try {
    const response = await apiClient.post<SpotReview>(ENDPOINTS.spotReviews.create, data);
    return response;
  } catch (error: any) {
    // Rethrow with message for UI to display
    if (error.message) {
      throw new Error(error.message);
    }
    throw new Error('Failed to create review');
  }
}

/**
 * Update an existing review
 */
export async function updateSpotReview(
  reviewId: string,
  data: UpdateReviewData,
): Promise<SpotReview | null> {
  try {
    const response = await apiClient.put<SpotReview>(ENDPOINTS.spotReviews.update(reviewId), data);
    return response;
  } catch (_error) {
    return null;
  }
}

/**
 * Delete a review (soft delete)
 */
export async function deleteSpotReview(reviewId: string): Promise<boolean> {
  try {
    await apiClient.delete(ENDPOINTS.spotReviews.delete(reviewId));
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Toggle helpful mark on a review
 */
export async function toggleReviewHelpful(
  reviewId: string,
): Promise<{ helpful: boolean; helpfulCount: number } | null> {
  try {
    const response = await apiClient.post<{ helpful: boolean; helpfulCount: number }>(
      ENDPOINTS.spotReviews.helpful(reviewId),
      {},
    );
    return response;
  } catch (_error) {
    return null;
  }
}

/**
 * Get reviews by a specific user
 */
export async function getUserReviews(
  userId: string,
  params: { page?: number; limit?: number } = {},
): Promise<{ reviews: (SpotReview & { spot?: any })[]; pagination: any }> {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const endpoint = queryString
      ? `${ENDPOINTS.spotReviews.byUser(userId)}?${queryString}`
      : ENDPOINTS.spotReviews.byUser(userId);

    const response = await apiClient.get<{ reviews: SpotReview[]; pagination: any }>(endpoint, {
      skipAuth: true,
    });
    return response;
  } catch (_error) {
    return {
      reviews: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
        hasMore: false,
      },
    };
  }
}
