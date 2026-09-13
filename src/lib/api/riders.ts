/**
 * Riders API
 * Two rider concepts share the /riders router on the backend:
 *  - Editorial riders (curated pro profiles, `riders` collection) → /riders/editorial
 *  - Network riders (community members who opted into discovery, `users`) → /riders
 * Both directory endpoints are public and paginated.
 */

import { apiClient } from './client';

export interface RiderRepBreakdown {
  parts: number;
  results: number;
  social: number;
  longevity: number;
  evidence: number;
}

export interface RiderRep {
  score: number;
  breakdown?: RiderRepBreakdown;
}

export interface EditorialRider {
  _id: string;
  slug: string;
  canonicalName: string;
  aliases?: string[];
  primarySport?: string;
  disciplines?: string[];
  nationality?: string;
  homeRegion?: string;
  biography?: string;
  officialWebsite?: string;
  socialLinks?: { platform: string; url: string }[];
  sponsors?: string[];
  teams?: string[];
  stance?: string;
  ridingStyle?: string;
  notableResults?: { placement?: string; event?: string; year?: number }[];
  signatureTricks?: string[];
  couchCredits?: {
    filmId?: string;
    filmSlug?: string;
    filmTitle?: string;
    creditedName?: string;
    role?: string;
  }[];
  activeYears?: { from?: number; to?: number };
  heroImage?: { url?: string; alt?: string; credit?: string };
  profileImage?: { url?: string; alt?: string; credit?: string };
  claimStatus?: 'unclaimed' | 'pending' | 'claimed';
  rep?: RiderRep;
}

export interface NetworkRider {
  _id: string;
  name: string;
  imageUri?: string;
  sports?: string[];
  bio?: string;
  riderProfile?: Record<string, unknown>;
  createdAt?: string;
}

export interface RiderPage<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface DirectoryParams {
  q?: string;
  sport?: string;
  page?: number;
  limit?: number;
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== null) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Editorial (curated pro) rider directory. Sport is lowercased server-side. */
export async function getEditorialRiders({
  q,
  sport,
  page = 1,
  limit = 24,
}: DirectoryParams = {}): Promise<RiderPage<EditorialRider>> {
  const query = toQuery({ q, sport: sport ? sport.toLowerCase() : undefined, page, limit });
  return apiClient.get<RiderPage<EditorialRider>>(`/riders/editorial${query}`, { skipAuth: true });
}

/** A single editorial rider by slug (enriched with film credit titles). */
export async function getEditorialRider(slug: string): Promise<EditorialRider> {
  return apiClient.get<EditorialRider>(`/riders/editorial/${encodeURIComponent(slug)}`, {
    skipAuth: true,
  });
}

/** Community (network member) rider directory. */
export async function getNetworkRiders({
  q,
  sport,
  page = 1,
  limit = 24,
}: DirectoryParams = {}): Promise<RiderPage<NetworkRider>> {
  const query = toQuery({ q, sport: sport ? sport.toLowerCase() : undefined, page, limit });
  return apiClient.get<RiderPage<NetworkRider>>(`/riders${query}`, { skipAuth: true });
}
