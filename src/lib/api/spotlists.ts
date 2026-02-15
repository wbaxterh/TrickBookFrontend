/**
 * SpotLists API
 * Functions for managing user's spot lists (collections of saved spots)
 */

import { ENDPOINTS } from '@/constants/api';
import type { CreateSpotListInput, SpotList, SpotListUsage } from '@/types/spots';
import { apiClient } from './client';
import type { Spot } from './spots';

/**
 * Get all spot lists for the current user
 */
export async function getSpotLists(): Promise<SpotList[]> {
  try {
    const response = await apiClient.get<SpotList[]>(ENDPOINTS.spotLists.list);
    return response;
  } catch (_error) {
    return [];
  }
}

/**
 * Get a single spot list by ID
 */
export async function getSpotList(listId: string): Promise<SpotList | null> {
  try {
    const response = await apiClient.get<SpotList>(ENDPOINTS.spotLists.detail(listId));
    return response;
  } catch (_error) {
    return null;
  }
}

/**
 * Get all spots in a specific list
 */
export async function getSpotsInList(listId: string): Promise<Spot[]> {
  try {
    const response = await apiClient.get<Spot[]>(`${ENDPOINTS.spotLists.detail(listId)}/spots`);
    return response;
  } catch (_error) {
    return [];
  }
}

/**
 * Create a new spot list
 */
export async function createSpotList(data: CreateSpotListInput): Promise<SpotList | null> {
  try {
    const response = await apiClient.post<SpotList>(ENDPOINTS.spotLists.create, data);
    return response;
  } catch (_error) {
    return null;
  }
}

/**
 * Update a spot list (name and/or description)
 */
export async function updateSpotList(listId: string, data: CreateSpotListInput): Promise<boolean> {
  try {
    await apiClient.put(ENDPOINTS.spotLists.update(listId), data);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Delete a spot list
 */
export async function deleteSpotList(listId: string): Promise<boolean> {
  try {
    await apiClient.delete(ENDPOINTS.spotLists.delete(listId));
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Add a spot to a list
 */
export async function addSpotToList(listId: string, spotId: string): Promise<boolean> {
  try {
    await apiClient.post(`${ENDPOINTS.spotLists.detail(listId)}/spots`, { spotId });
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Remove a spot from a list
 */
export async function removeSpotFromList(listId: string, spotId: string): Promise<boolean> {
  try {
    await apiClient.delete(`${ENDPOINTS.spotLists.detail(listId)}/spots/${spotId}`);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Get user's spot list usage (for subscription limits)
 */
export async function getSpotListUsage(): Promise<SpotListUsage | null> {
  try {
    const response = await apiClient.get<SpotListUsage>(`${ENDPOINTS.spotLists.list}/usage`);
    return response;
  } catch (_error) {
    return null;
  }
}
