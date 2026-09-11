/**
 * Event date/location formatting shared by the Events list + detail screens.
 */

import type { TrickEvent } from '@/lib/api/events';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 26 – 28, 2026" / "Sep 26, 2026" / "Date TBA". */
export function formatEventDate(event: TrickEvent): string {
  if (event.timeTba && !event.startAt) return 'Date TBA';
  if (!event.startAt) return 'Date TBA';
  const start = new Date(event.startAt);
  if (Number.isNaN(start.getTime())) return 'Date TBA';
  const startStr = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const year = start.getFullYear();
  if (!event.endAt) return `${startStr}, ${year}`;
  const end = new Date(event.endAt);
  if (Number.isNaN(end.getTime())) return `${startStr}, ${year}`;
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return `${startStr}, ${year}`;
  const sameMonth = start.getMonth() === end.getMonth() && year === end.getFullYear();
  const endStr = sameMonth ? `${end.getDate()}` : `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `${startStr} – ${endStr}, ${end.getFullYear()}`;
}

/** "Hunter, NY" / "Online" / "" — city + region, tolerant of missing parts. */
export function formatEventLocation(event: TrickEvent): string {
  if (event.isOnline) return 'Online';
  const v = event.venue;
  if (!v) return '';
  const parts = [v.city, v.region ?? v.country].filter(Boolean);
  return parts.join(', ');
}

/** True when the event's end (or start) is still in the future. */
export function isUpcoming(event: TrickEvent): boolean {
  const ref = event.endAt ?? event.startAt;
  if (!ref) return true;
  const t = new Date(ref).getTime();
  return Number.isNaN(t) ? true : t >= Date.now();
}
