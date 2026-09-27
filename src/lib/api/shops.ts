/**
 * Shops API — the core skate/board shop directory (mirrors the web /shops page).
 * Public list + detail; comments require auth to post.
 */

import { ENDPOINTS } from '@/constants/api';
import { apiClient } from './client';

export interface ShopAddress {
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
  location?: { type: 'Point'; coordinates: [number, number] };
}

/** A shop's team rider — links internally to the editorial rider profile via slug. */
export interface ShopTeamRider {
  name: string;
  slug?: string | null;
  imageUrl?: string | null;
}

export interface ShopSocialLinks {
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
  x?: string;
  [key: string]: string | undefined;
}

export interface Shop {
  _id: string;
  slug?: string;
  name: string;
  description?: string;
  sports?: string[];
  services?: string[];
  address?: ShopAddress;
  website?: string;
  phone?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  reviewSummary?: string;
  faqs?: Array<{ question: string; answer: string }>;
  pressFeatures?: Array<{ title: string; url?: string; source?: string }>;
  teamRiders?: ShopTeamRider[];
  hours?: Record<string, string> | Array<{ day: string; open?: string; close?: string }>;
  socialLinks?: ShopSocialLinks;
  verified?: boolean;
  featured?: boolean;
  updatedAt?: string;
}

export interface ShopComment {
  _id: string;
  shopId: string;
  userId: string;
  content: string;
  parentCommentId?: string | null;
  user?: { name: string; imageUri?: string | null };
  createdAt: string;
}

export interface ShopListParams {
  q?: string;
  sport?: string;
  service?: string;
  location?: string;
  cursor?: string;
  limit?: number;
}

export interface ShopListResponse {
  shops: Shop[];
  totalCount: number | null;
  nextCursor: string | null;
}

/** List published shops with optional filters. Cursor-paginated. */
export async function getShops(params: ShopListParams = {}): Promise<ShopListResponse> {
  try {
    const qp = new URLSearchParams();
    if (params.q?.trim()) qp.append('q', params.q.trim());
    if (params.sport && params.sport !== 'all') qp.append('sport', params.sport);
    if (params.service && params.service !== 'all') qp.append('service', params.service);
    if (params.location?.trim()) qp.append('location', params.location.trim());
    if (params.cursor) qp.append('cursor', params.cursor);
    if (params.limit) qp.append('limit', String(params.limit));

    const qs = qp.toString();
    const endpoint = qs ? `${ENDPOINTS.shops.list}?${qs}` : ENDPOINTS.shops.list;
    const res = await apiClient.get<ShopListResponse | Shop[]>(endpoint, { skipAuth: true });
    if (Array.isArray(res)) return { shops: res, totalCount: res.length, nextCursor: null };
    return {
      shops: res.shops ?? [],
      totalCount: res.totalCount ?? null,
      nextCursor: res.nextCursor ?? null,
    };
  } catch (_error) {
    return { shops: [], totalCount: null, nextCursor: null };
  }
}

/** Fetch a single shop by slug or id. */
export async function getShop(slugOrId: string): Promise<Shop | null> {
  try {
    const res = await apiClient.get<{ shop?: Shop } | Shop>(ENDPOINTS.shops.detail(slugOrId), {
      skipAuth: true,
    });
    return (res as { shop?: Shop }).shop ?? (res as Shop);
  } catch (_error) {
    return null;
  }
}

/** Public, paginated (newest-first) top-level comments for a shop. */
export async function getShopComments(
  slugOrId: string,
  params: { page?: number; limit?: number } = {},
): Promise<{
  comments: ShopComment[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
}> {
  try {
    const qp = new URLSearchParams();
    if (params.page) qp.append('page', String(params.page));
    if (params.limit) qp.append('limit', String(params.limit));
    const qs = qp.toString();
    const endpoint = qs
      ? `${ENDPOINTS.shops.comments(slugOrId)}?${qs}`
      : ENDPOINTS.shops.comments(slugOrId);
    return await apiClient.get(endpoint, { skipAuth: true });
  } catch (_error) {
    return { comments: [], pagination: { page: 1, limit: 20, total: 0, hasMore: false } };
  }
}

/** Post a comment (or reply) on a shop. Requires auth. */
export async function addShopComment(
  slugOrId: string,
  content: string,
  parentCommentId?: string,
): Promise<ShopComment | null> {
  try {
    return await apiClient.post<ShopComment>(ENDPOINTS.shops.comments(slugOrId), {
      content,
      parentCommentId,
    });
  } catch (_error) {
    return null;
  }
}

/** Delete one of your own shop comments. */
export async function deleteShopComment(slugOrId: string, commentId: string): Promise<boolean> {
  try {
    await apiClient.delete(ENDPOINTS.shops.deleteComment(slugOrId, commentId));
    return true;
  } catch (_error) {
    return false;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

const SPORT_LABELS: Record<string, string> = {
  skateboarding: 'Skateboarding',
  snowboarding: 'Snowboarding',
  skiing: 'Skiing',
  surfing: 'Surfing',
  surf: 'Surfing',
  bmx: 'BMX',
  mtb: 'Mountain Biking',
  scooter: 'Scooter',
  rollerblading: 'Rollerblading',
  wakeboarding: 'Wakeboarding',
};

export function formatSportLabel(sport: string): string {
  return SPORT_LABELS[sport.toLowerCase()] ?? sport.charAt(0).toUpperCase() + sport.slice(1);
}

/** Human-readable "City, ST" (falls back gracefully). */
export function formatShopLocation(shop: Shop): string {
  const a = shop.address;
  if (!a) return '';
  return [a.city, a.region].filter(Boolean).join(', ');
}
