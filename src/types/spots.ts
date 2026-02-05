/**
 * Spot Types
 * Type definitions for spots and spot lists
 */

import { Spot } from '@/lib/api/spots';

/**
 * SpotList - A user's collection of saved spots
 */
export interface SpotList {
  _id: string;
  name: string;
  description?: string;
  userId: string;
  spotIds: string[];
  spotCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * SpotList with full spot data populated
 */
export interface SpotListWithSpots extends SpotList {
  spots: Spot[];
}

/**
 * Input for creating a new spot list
 */
export interface CreateSpotListInput {
  name: string;
  description?: string;
}

/**
 * Usage stats for subscription limits
 */
export interface SpotListUsage {
  spotListsCount: number;
  totalSpotsCount: number;
  subscription: {
    plan: 'free' | 'premium';
    status: string;
  };
  isPremium: boolean;
  isAdmin: boolean;
  limits: {
    maxSpotLists: number | 'unlimited';
    maxSpotsPerList: number | 'unlimited';
    maxTotalSpots: number | 'unlimited';
  };
}
