/**
 * Spots API
 * Functions for fetching and managing spots
 */

import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import { API_CONFIG, ENDPOINTS } from '@/constants/api';
import { apiClient } from './client';

// Types
export interface SpotPhoto {
  url: string;
  attribution?: string;
  key?: string;
  userId?: string;
  uploadedAt?: string;
}

export interface Spot {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
  imageURL?: string | null;
  description?: string;
  rating?: number;
  tags?: string;
  city?: string;
  state?: string;
  isPublic?: boolean;
  sportTypes?: string[];
  category?: 'park' | 'street' | 'indoor' | 'diy' | 'resort' | 'other';
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'private';
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  // Computed fields for display
  distance?: number;
  reviewCount?: number;
  // Google Places integration
  googlePlaceId?: string;
  googlePhotos?: SpotPhoto[];
  userPhotos?: SpotPhoto[];
  googlePlacesCachedAt?: string;
}

export interface SportType {
  value: string;
  label: string;
}

export interface SpotCategory {
  id: string;
  name: string;
  icon: string;
}

export interface SpotsResponse {
  spots: Spot[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface GetSpotsParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  sportType?: string;
  category?: string;
  q?: string;
}

/**
 * Get available sport types for filtering
 */
export async function getSportTypes(): Promise<SportType[]> {
  try {
    const response = await apiClient.get<{ sportTypes: SportType[] }>(
      `${ENDPOINTS.spots.list}/sport-types`,
      { skipAuth: true },
    );
    return response.sportTypes;
  } catch (_error) {
    // Return default sport types if API fails
    return [
      { value: 'skateboarding', label: 'Skateboarding' },
      { value: 'snowboarding', label: 'Snowboarding' },
      { value: 'skiing', label: 'Skiing' },
      { value: 'bmx', label: 'BMX' },
      { value: 'mtb', label: 'MTB' },
      { value: 'scooter', label: 'Scooter' },
      { value: 'rollerblading', label: 'Rollerblading' },
      { value: 'surfing', label: 'Surfing' },
      { value: 'wakeboarding', label: 'Wakeboarding' },
    ];
  }
}

/**
 * Get available spot categories (park, street, etc.)
 */
export async function getSpotCategories(): Promise<SpotCategory[]> {
  try {
    const response = await apiClient.get<{ spotCategories: SpotCategory[] }>(
      `${ENDPOINTS.spots.list}/spot-categories`,
      { skipAuth: true },
    );
    return response.spotCategories;
  } catch (_error) {
    return [
      { id: 'park', name: 'Park', icon: 'leaf' },
      { id: 'street', name: 'Street', icon: 'business' },
      { id: 'indoor', name: 'Indoor', icon: 'home' },
      { id: 'diy', name: 'DIY', icon: 'construct' },
      { id: 'resort', name: 'Resort', icon: 'snow' },
      { id: 'other', name: 'Other', icon: 'ellipsis-horizontal' },
    ];
  }
}

/**
 * Get spots with optional filters
 */
export async function getSpots(params: GetSpotsParams = {}): Promise<SpotsResponse> {
  try {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.order) queryParams.append('order', params.order);
    if (params.sportType && params.sportType !== 'all') {
      queryParams.append('sportType', params.sportType);
    }
    if (params.category && params.category !== 'all') {
      queryParams.append('category', params.category);
    }
    if (params.q) queryParams.append('q', params.q);

    const queryString = queryParams.toString();
    const endpoint = queryString ? `${ENDPOINTS.spots.list}?${queryString}` : ENDPOINTS.spots.list;

    const response = await apiClient.get<SpotsResponse>(endpoint, { skipAuth: true });
    return response;
  } catch (_error) {
    return {
      spots: [],
      pagination: {
        page: 1,
        limit: 50,
        totalCount: 0,
        totalPages: 0,
        hasMore: false,
      },
    };
  }
}

export interface MapPin {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
  sportTypes?: string[];
  rating?: number;
  imageURL?: string | null;
  city?: string;
  state?: string;
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Get lightweight map pins inside a bounding box, optionally filtered by sport/category.
 */
export async function getMapPins(
  bounds: MapBounds,
  sportType?: string,
  category?: string,
): Promise<MapPin[]> {
  try {
    const params = new URLSearchParams({
      minLat: bounds.minLat.toString(),
      maxLat: bounds.maxLat.toString(),
      minLng: bounds.minLng.toString(),
      maxLng: bounds.maxLng.toString(),
    });
    if (sportType && sportType !== 'all') params.append('sportType', sportType);
    if (category && category !== 'all') params.append('category', category);

    const response = await apiClient.get<MapPin[]>(
      `${ENDPOINTS.spots.list}/map-pins?${params.toString()}`,
      { skipAuth: true },
    );
    return response || [];
  } catch (_error) {
    return [];
  }
}

/**
 * Search spots by query
 */
export async function searchSpots(
  query: string,
  filters: { city?: string; state?: string; tags?: string } = {},
): Promise<SpotsResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (query) queryParams.append('q', query);
    if (filters.city) queryParams.append('city', filters.city);
    if (filters.state) queryParams.append('state', filters.state);
    if (filters.tags) queryParams.append('tags', filters.tags);

    const response = await apiClient.get<SpotsResponse>(
      `${ENDPOINTS.spots.search}?${queryParams.toString()}`,
      { skipAuth: true },
    );
    return response;
  } catch (_error) {
    return {
      spots: [],
      pagination: {
        page: 1,
        limit: 50,
        totalCount: 0,
        totalPages: 0,
        hasMore: false,
      },
    };
  }
}

/**
 * Get a single spot by ID
 */
export async function getSpotById(id: string): Promise<Spot | null> {
  try {
    const response = await apiClient.get<Spot>(ENDPOINTS.spots.detail(id), { skipAuth: true });
    return response;
  } catch (_error) {
    return null;
  }
}

/**
 * Create a new spot
 */
export async function createSpot(
  spot: Omit<Spot, '_id' | 'createdAt' | 'updatedAt' | 'userId' | 'approvalStatus'>,
): Promise<Spot | null> {
  try {
    const response = await apiClient.post<Spot>(ENDPOINTS.spots.create, spot);
    return response;
  } catch (_error) {
    return null;
  }
}

/**
 * Update a spot
 */
export async function updateSpot(id: string, updates: Partial<Spot>): Promise<Spot | null> {
  try {
    const response = await apiClient.put<Spot>(ENDPOINTS.spots.detail(id), updates);
    return response;
  } catch (_error) {
    return null;
  }
}

/**
 * Delete a spot (owner only). Returns true on success.
 */
export async function deleteSpot(id: string): Promise<boolean> {
  try {
    await apiClient.delete(ENDPOINTS.spots.detail(id));
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Get user's own spots
 */
export async function getMySpots(
  params: { page?: number; limit?: number } = {},
): Promise<SpotsResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const endpoint = queryString
      ? `${ENDPOINTS.spots.list}/my-spots?${queryString}`
      : `${ENDPOINTS.spots.list}/my-spots`;

    const response = await apiClient.get<SpotsResponse>(endpoint);
    return response;
  } catch (_error) {
    return {
      spots: [],
      pagination: {
        page: 1,
        limit: 50,
        totalCount: 0,
        totalPages: 0,
        hasMore: false,
      },
    };
  }
}

/**
 * Get the current user's saved spots (the "Saved" half of My Spots).
 */
export async function getSavedSpots(
  params: { page?: number; limit?: number } = {},
): Promise<SpotsResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    const queryString = queryParams.toString();
    const endpoint = queryString
      ? `${ENDPOINTS.spots.list}/saved?${queryString}`
      : `${ENDPOINTS.spots.list}/saved`;
    return await apiClient.get<SpotsResponse>(endpoint);
  } catch (_error) {
    return {
      spots: [],
      pagination: { page: 1, limit: 50, totalCount: 0, totalPages: 0, hasMore: false },
    };
  }
}

/**
 * One-tap save: add a spot to the user's "Saved Spots". Returns true on success.
 */
export async function saveSpot(id: string): Promise<boolean> {
  try {
    await apiClient.post(`${ENDPOINTS.spots.detail(id)}/save`);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Remove a spot from the user's "Saved Spots". Returns true on success.
 */
export async function unsaveSpot(id: string): Promise<boolean> {
  try {
    await apiClient.delete(`${ENDPOINTS.spots.detail(id)}/save`);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Whether the current user has saved this spot (checks the default Saved bucket).
 */
export async function isSpotSaved(id: string): Promise<boolean> {
  try {
    const lists = await apiClient.get<{ isDefaultSaved?: boolean }[]>(
      `${ENDPOINTS.spots.detail(id)}/lists`,
    );
    return Array.isArray(lists) && lists.some((l) => l.isDefaultSaved === true);
  } catch (_error) {
    return false;
  }
}

/**
 * Upload one user photo to a spot (multipart). Uses expo-file-system for
 * reliable uploads on physical iOS devices. Returns the created photo or null.
 */
export async function uploadSpotPhoto(
  spotId: string,
  fileUri: string,
  mimeType: string = 'image/jpeg',
): Promise<SpotPhoto | null> {
  try {
    const token = await apiClient.getToken();
    const result = await uploadAsync(
      `${API_CONFIG.baseUrl}${ENDPOINTS.spots.detail(spotId)}/photos`,
      fileUri,
      {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: 'photo',
        mimeType,
        headers: token ? { 'x-auth-token': token } : {},
      },
    );
    if (result.status !== 200 && result.status !== 201) {
      return null;
    }
    return JSON.parse(result.body) as SpotPhoto;
  } catch (_error) {
    return null;
  }
}

/**
 * Report a user-uploaded spot photo for review (any authenticated user).
 * Returns true on success.
 */
export async function reportSpotPhoto(spotId: string, photoKey: string): Promise<boolean> {
  try {
    // The S3 key contains a "/" (e.g. "spots/<uuid>.jpg"); encode it so it stays
    // a single path segment and the :photoKey route matches.
    await apiClient.post(
      `${ENDPOINTS.spots.detail(spotId)}/photos/${encodeURIComponent(photoKey)}/report`,
    );
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Delete a user-uploaded spot photo (uploader/owner or admin). Returns true on success.
 */
export async function deleteSpotPhoto(spotId: string, photoKey: string): Promise<boolean> {
  try {
    await apiClient.delete(
      `${ENDPOINTS.spots.detail(spotId)}/photos/${encodeURIComponent(photoKey)}`,
    );
    return true;
  } catch (_error) {
    return false;
  }
}

// Google Places integration types
export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  types?: string[];
  photos?: { reference: string }[];
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  reviewCount?: number;
  types?: string[];
  openingHours?: any;
  photos?: { reference: string; attribution?: string }[];
}

export interface ReverseGeocodeResult {
  address: string | null;
  city: string;
  state: string;
  country: string;
  placeId?: string;
}

/**
 * Search Google Places by query
 */
export async function searchPlaces(
  query: string,
  lat?: number,
  lng?: number,
): Promise<PlaceSearchResult[]> {
  try {
    const params = new URLSearchParams();
    params.append('query', query);
    if (lat) params.append('lat', lat.toString());
    if (lng) params.append('lng', lng.toString());

    const response = await apiClient.get<{ results: PlaceSearchResult[] }>(
      `${ENDPOINTS.spots.list}/places-search?${params.toString()}`,
    );
    return response.results || [];
  } catch (_error) {
    return [];
  }
}

/**
 * Get place details by Google Place ID
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const response = await apiClient.get<PlaceDetails>(`${ENDPOINTS.spots.list}/places/${placeId}`);
    return response;
  } catch (_error) {
    return null;
  }
}

/**
 * Reverse geocode coordinates to get address info
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  try {
    const response = await apiClient.get<ReverseGeocodeResult>(
      `${ENDPOINTS.spots.list}/reverse-geocode?lat=${lat}&lng=${lng}`,
    );
    return response;
  } catch (_error) {
    return { address: null, city: '', state: '', country: '' };
  }
}
