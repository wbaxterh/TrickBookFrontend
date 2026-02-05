/**
 * TrickBook Type Definitions
 * Aligned with Backend data models
 */

// Trick difficulty levels
export type TrickDifficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

// Trick status for user's lists
export type TrickStatus = 'Not Started' | 'Learning' | 'Landed' | 'Mastered';

// Legacy status mapping (backend uses these)
export type LegacyTrickStatus = 'To Do' | 'Complete' | 'Completed' | 'Learning';

// Trickipedia trick (from /api/trickipedia)
export interface Trick {
  _id: string;
  id?: string;
  name: string;
  category: string;
  difficulty: TrickDifficulty;
  description: string;
  steps: string[];
  images?: string[];
  videoUrl?: string;
  url?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Category (from /api/categories)
export interface Category {
  _id: string;
  name: string;
  icon: string;
  backgroundColor: string;
  color: string;
}

// Individual trick in a user's list
export interface TrickListItem {
  _id: string;
  name: string;
  link?: string;
  notes?: string;
  checked: LegacyTrickStatus;
  status?: TrickStatus; // Computed from checked
  trickipediaId?: string; // Links to Trickipedia trick._id for "View Tutorial" feature
  difficulty?: TrickDifficulty;
  createdAt?: string;
  updatedAt?: string;
}

// User's trick list
export interface TrickList {
  _id: string;
  name: string;
  tricks: TrickListItem[];
  isPublic?: boolean;
  user?: {
    $id: string;
    name?: string;
    imageUri?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

// Progress calculation for a list
export interface ListProgress {
  total: number;
  landed: number;
  learning: number;
  notStarted: number;
  mastered: number;
  percentage: number;
}

// Helper to convert legacy status to new status
// Backend uses: "To Do", "Complete", "Completed", "Learning"
export function convertStatus(checked: LegacyTrickStatus | string | undefined): TrickStatus {
  if (checked === 'Complete' || checked === 'Completed') {
    return 'Landed';
  }
  if (checked === 'Learning') {
    return 'Learning';
  }
  return 'Not Started';
}

// Helper to calculate list progress
// Uses the 'checked' field from backend: "To Do", "Complete", "Completed", "Learning"
export function calculateProgress(tricks: TrickListItem[]): ListProgress {
  const total = tricks.length;
  if (total === 0) {
    return { total: 0, landed: 0, learning: 0, notStarted: total, mastered: 0, percentage: 0 };
  }

  let landed = 0;
  let learning = 0;
  let notStarted = 0;
  let mastered = 0;

  tricks.forEach((trick) => {
    // Check the backend 'checked' field first, then fall back to 'status'
    const checked = trick.checked;
    const status = trick.status;

    // Backend values: "Complete" or "Completed" = landed
    if (checked === 'Complete' || checked === 'Completed') {
      landed++;
    } else if (checked === 'Learning') {
      learning++;
    } else if (status === 'Mastered') {
      mastered++;
    } else if (status === 'Landed') {
      landed++;
    } else if (status === 'Learning') {
      learning++;
    } else {
      // "To Do" or anything else = not started
      notStarted++;
    }
  });

  const completed = landed + mastered;
  const percentage = Math.round((completed / total) * 100);

  return { total, landed, learning, notStarted, mastered, percentage };
}

// Status colors matching the design
export const STATUS_COLORS = {
  'Not Started': '#666666',
  'Learning': '#FF9800',
  'Landed': '#4CAF50',
  'Mastered': '#FFD700',
} as const;

// Difficulty colors
export const DIFFICULTY_COLORS = {
  'Beginner': '#4CAF50',
  'Intermediate': '#FF9800',
  'Advanced': '#F44336',
  'Expert': '#9C27B0',
} as const;
