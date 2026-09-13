/**
 * Events API
 * Public, cursor-paginated events archive (X-Games / Boardr / resort sources).
 * Save/unsave requires auth. Response is proximity-sorted (nearest to now).
 */

import { apiClient } from './client';

export interface EventVenue {
  name?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
}

export interface EventOrganizer {
  name?: string;
  verified?: boolean;
  venueHost?: string;
}

export interface EventParticipation {
  registrationStatus?: 'open' | 'closed' | 'required' | 'not_required' | string;
  registrationUrl?: string;
  registrationDeadlineAt?: string | null;
}

export interface EventSpectating {
  inPerson?: boolean;
  streamUrl?: string;
  ticketUrl?: string;
  ticketStatus?: string;
  ticketPrice?: string;
}

export interface EventLink {
  kind?: string;
  label?: string;
  url: string;
}

export interface TrickEvent {
  _id: string;
  slug: string;
  title: string;
  description?: string;
  sports?: string[];
  disciplines?: string[];
  startAt?: string;
  endAt?: string;
  timeTba?: boolean;
  timezone?: string;
  venue?: EventVenue;
  isOnline?: boolean;
  organizer?: EventOrganizer;
  series?: string;
  sanctioningBody?: string;
  participation?: EventParticipation;
  spectating?: EventSpectating;
  intents?: string[];
  eventKinds?: string[];
  level?: string[];
  status?: string;
  image?: string;
  externalLinks?: EventLink[];
  resultsUrl?: string;
  resultsSummary?: string;
  prizeSummary?: string;
}

export interface EventsPage {
  events: TrickEvent[];
  nextCursor: string | number | null;
  totalCount: number | null;
}

export interface EventFilters {
  q?: string;
  sport?: string;
  location?: string;
  date?: 'week' | 'month' | 'weekend' | string;
  intent?: string;
  registration?: string;
}

function buildQuery(filters: EventFilters, cursor?: string | number | null): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      params.set(key, String(value));
    }
  }
  if (cursor !== undefined && cursor !== null && cursor !== '') {
    params.set('cursor', String(cursor));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getEvents(
  filters: EventFilters = {},
  cursor?: string | number | null,
): Promise<EventsPage> {
  const payload = await apiClient.get<
    | { events?: TrickEvent[]; nextCursor?: string | number | null; totalCount?: number }
    | TrickEvent[]
  >(`/events${buildQuery(filters, cursor)}`, { skipAuth: true });
  if (Array.isArray(payload)) {
    return { events: payload, nextCursor: null, totalCount: payload.length };
  }
  return {
    events: payload.events ?? [],
    nextCursor: payload.nextCursor ?? null,
    totalCount: payload.totalCount ?? null,
  };
}

export async function getEvent(slugOrId: string): Promise<TrickEvent> {
  const payload = await apiClient.get<{ event?: TrickEvent } | TrickEvent>(
    `/events/${encodeURIComponent(slugOrId)}`,
    { skipAuth: true },
  );
  return (payload as { event?: TrickEvent }).event ?? (payload as TrickEvent);
}

export async function saveEvent(eventId: string): Promise<{ saved: boolean }> {
  return apiClient.post<{ saved: boolean }>(`/events/${eventId}/save`, {});
}

export async function unsaveEvent(eventId: string): Promise<{ saved: boolean }> {
  return apiClient.delete<{ saved: boolean }>(`/events/${eventId}/save`);
}
