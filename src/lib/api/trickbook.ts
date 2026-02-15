/**
 * TrickBook API Functions
 * Endpoints for Trickipedia and TrickLists
 */

import { API_CONFIG } from '@/constants/api';
import type { Category, Trick, TrickList, TrickStatus } from '@/types/trickbook';

const API_BASE = API_CONFIG.baseUrl;

// Fetch all tricks from Trickipedia
export async function getTricks(params?: {
  category?: string;
  difficulty?: string;
  search?: string;
}): Promise<Trick[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.difficulty) queryParams.append('difficulty', params.difficulty);
    if (params?.search) queryParams.append('search', params.search);

    const url = `${API_BASE}/trickipedia${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch tricks');
    }

    return response.json();
  } catch (_error) {
    return [];
  }
}

// Fetch tricks by category
export async function getTricksByCategory(category: string): Promise<Trick[]> {
  try {
    const response = await fetch(`${API_BASE}/trickipedia/category/${category}`);

    if (!response.ok) {
      throw new Error('Failed to fetch tricks by category');
    }

    const data = await response.json();
    return data.tricks || [];
  } catch (_error) {
    return [];
  }
}

// Fetch single trick by ID
export async function getTrickById(id: string): Promise<Trick | null> {
  try {
    const response = await fetch(`${API_BASE}/trickipedia/${id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch trick');
    }

    return response.json();
  } catch (_error) {
    return null;
  }
}

// Fetch all categories
export async function getCategories(): Promise<Category[]> {
  try {
    const response = await fetch(`${API_BASE}/categories`);

    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }

    return response.json();
  } catch (_error) {
    return [];
  }
}

// Fetch user's trick lists
export async function getUserTrickLists(userId: string, token: string): Promise<TrickList[]> {
  try {
    // Backend uses /listings for trick lists
    const url = `${API_BASE}/listings?userId=${userId}`;

    const response = await fetch(url, {
      headers: {
        'x-auth-token': token,
      },
    });

    if (!response.ok) {
      const _errorText = await response.text();
      throw new Error('Failed to fetch trick lists');
    }

    const data = await response.json();
    return data;
  } catch (_error) {
    return [];
  }
}

// Create a new trick list
export async function createTrickList(
  name: string,
  userId: string,
  token: string,
): Promise<TrickList | null> {
  try {
    // Backend expects 'title' not 'name'
    const response = await fetch(`${API_BASE}/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({ title: name, userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to create trick list');
    }

    return response.json();
  } catch (_error) {
    return null;
  }
}

// Delete a trick list
export async function deleteTrickList(listId: string, token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/listings/${listId}`, {
      method: 'DELETE',
      headers: {
        'x-auth-token': token,
      },
    });

    return response.ok;
  } catch (_error) {
    return false;
  }
}

// Update/rename a trick list
export async function updateTrickList(
  listId: string,
  name: string,
  token: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/listings/edit`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({ trickListId: listId, name }),
    });

    return response.ok;
  } catch (_error) {
    return false;
  }
}

// Update trick status in a list
// Backend uses PUT /listing/update with { _id, checked } where checked is "To Do" or "Completed"
export async function updateTrickStatus(
  _listId: string,
  trickId: string,
  status: TrickStatus,
  token: string,
): Promise<boolean> {
  try {
    // Map our status to backend's checked format
    const checked =
      status === 'Mastered' || status === 'Landed'
        ? 'Completed'
        : status === 'Learning'
          ? 'Learning'
          : 'To Do';

    const response = await fetch(`${API_BASE}/listing/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({ _id: trickId, checked }),
    });

    return response.ok;
  } catch (_error) {
    return false;
  }
}

// Add trick to a list
// Optional trickipediaId links the trick back to the Trickipedia entry
export async function addTrickToList(
  listId: string,
  trick: { name: string; link?: string; notes?: string; trickipediaId?: string },
  token: string,
): Promise<boolean> {
  try {
    const body: Record<string, string> = {
      list_id: listId,
      name: trick.name,
      link: trick.link || '',
      notes: trick.notes || '',
      checked: 'To Do',
    };

    // Include trickipediaId if provided (for linking back to Trickipedia)
    if (trick.trickipediaId) {
      body.trickipediaId = trick.trickipediaId;
    }

    const response = await fetch(`${API_BASE}/listing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify(body),
    });

    return response.ok;
  } catch (_error) {
    return false;
  }
}

// Fetch public trick lists (homie lists)
export async function getPublicTrickLists(token?: string): Promise<TrickList[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['x-auth-token'] = token;
    }

    const response = await fetch(`${API_BASE}/listings/public`, { headers });

    if (!response.ok) {
      throw new Error('Failed to fetch public trick lists');
    }

    return response.json();
  } catch (_error) {
    return [];
  }
}

// Fetch a single trick list by ID
// Note: Backend doesn't have a GET /listings/:id endpoint
// So we fetch all lists and find the matching one, or fetch tricks separately
export async function getTrickList(
  listId: string,
  token: string,
  userId?: string,
): Promise<TrickList | null> {
  try {
    // If we have userId, fetch all lists and find the matching one
    // (The GET /listings endpoint already enriches tricks with full data)
    if (userId) {
      const allLists = await getUserTrickLists(userId, token);

      // Handle both string and ObjectId comparison
      const list = allLists.find((l) => {
        const listIdStr = typeof l._id === 'object' ? String(l._id) : l._id;
        return listIdStr === listId;
      });

      if (list) {
        if (list.tricks?.[0]) {
        }
        return list;
      }
    }

    // Fallback: fetch tricks for this list and construct a basic list object
    const tricksResponse = await fetch(`${API_BASE}/listing?list_id=${listId}`, {
      headers: {
        'x-auth-token': token,
      },
    });

    if (!tricksResponse.ok) {
      throw new Error('Failed to fetch tricks for list');
    }

    const tricks = await tricksResponse.json();
    if (tricks[0]) {
    }

    // Return a basic list structure with the tricks
    // IMPORTANT: Preserve the `checked` field from the backend
    return {
      _id: listId,
      name: 'Trick List', // Name unknown without fetching all lists
      tricks: tricks.map((t: any) => ({
        _id: t._id,
        name: t.name,
        checked: t.checked || 'To Do', // Preserve original checked field
        status:
          t.checked === 'Complete' || t.checked === 'Completed'
            ? 'Mastered'
            : t.checked === 'Learning'
              ? 'Learning'
              : 'Not Started',
        link: t.link,
        notes: t.notes,
        createdAt: t.createdAt,
      })),
      isPublic: false,
    } as TrickList;
  } catch (_error) {
    return null;
  }
}

// Remove a trick from a list
// Backend uses DELETE /listing/:trickId (not /listings)
export async function removeTrickFromList(
  _listId: string,
  trickId: string,
  token: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/listing/${trickId}`, {
      method: 'DELETE',
      headers: {
        'x-auth-token': token,
      },
    });

    return response.ok;
  } catch (_error) {
    return false;
  }
}

// Edit a trick (name, link, notes)
// Backend uses PUT /listing/edit with { trickId, name, link, notes }
export async function editTrick(
  trickId: string,
  updates: { name: string; link?: string; notes?: string },
  token: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/listing/edit`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({
        trickId,
        name: updates.name,
        link: updates.link || '',
        notes: updates.notes || '',
      }),
    });

    return response.ok;
  } catch (_error) {
    return false;
  }
}
