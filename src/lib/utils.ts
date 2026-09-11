/**
 * Utility functions
 * Matches pattern from TrickBook Website /lib/utils.js
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { API_CONFIG } from '@/constants/api';

/**
 * Combines class names using clsx and tailwind-merge
 * Prevents Tailwind class conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resolve an asset reference to an absolute URL the app can load.
 *
 * Shared trick/spot data sometimes stores website-relative paths (e.g.
 * "/images/trickipedia/bmx-180.jpg") that resolve against the website origin
 * on the web, but React Native's <Image> silently fails on relative URIs and
 * needs an absolute one. Absolute (http/https/data) URLs pass through
 * unchanged; root-relative paths are prefixed with the website origin.
 */
export function resolveAssetUrl(uri?: string | null): string | undefined {
  if (!uri) return undefined;
  const trimmed = uri.trim();
  if (!trimmed) return undefined;
  if (/^(https?:|data:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${API_CONFIG.assetBaseUrl}${trimmed}`;
  return trimmed;
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return num.toString();
}

/**
 * Format relative time (e.g., "2h ago", "3d ago")
 */
export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}
