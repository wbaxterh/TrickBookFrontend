import type { TrickEvent } from '@/lib/api/events';
import { formatEventDate, formatEventLocation, isUpcoming } from '@/lib/eventFormat';

const base: TrickEvent = { _id: 'e1', slug: 'test-event', title: 'Test Event' };
const event = (overrides: Partial<TrickEvent>): TrickEvent => ({ ...base, ...overrides });

describe('formatEventDate', () => {
  it('formats a single-day event as "Mon D, YYYY"', () => {
    expect(formatEventDate(event({ startAt: '2026-09-26T18:00:00' }))).toBe('Sep 26, 2026');
    expect(
      formatEventDate(event({ startAt: '2026-09-26T09:00:00', endAt: '2026-09-26T18:00:00' })),
    ).toBe('Sep 26, 2026');
  });

  it('collapses a same-month range to one month label', () => {
    expect(
      formatEventDate(event({ startAt: '2026-09-26T09:00:00', endAt: '2026-09-28T18:00:00' })),
    ).toBe('Sep 26 – 28, 2026');
  });

  it('spells out both months for a cross-month range', () => {
    expect(
      formatEventDate(event({ startAt: '2026-09-30T09:00:00', endAt: '2026-10-02T18:00:00' })),
    ).toBe('Sep 30 – Oct 2, 2026');
  });

  it('uses the end year when a range crosses New Year', () => {
    expect(
      formatEventDate(event({ startAt: '2026-12-31T09:00:00', endAt: '2027-01-01T18:00:00' })),
    ).toBe('Dec 31 – Jan 1, 2027');
  });

  it('falls back to "Date TBA" when the date is missing, flagged TBA, or unparseable', () => {
    expect(formatEventDate(event({}))).toBe('Date TBA');
    expect(formatEventDate(event({ timeTba: true }))).toBe('Date TBA');
    expect(formatEventDate(event({ startAt: 'not-a-date' }))).toBe('Date TBA');
  });

  it('ignores an unparseable end date', () => {
    expect(formatEventDate(event({ startAt: '2026-09-26T09:00:00', endAt: 'garbage' }))).toBe(
      'Sep 26, 2026',
    );
  });
});

describe('formatEventLocation', () => {
  it('prefers "Online" for online events', () => {
    expect(formatEventLocation(event({ isOnline: true, venue: { city: 'Hunter' } }))).toBe(
      'Online',
    );
  });

  it('joins city and region, falling back to country', () => {
    expect(formatEventLocation(event({ venue: { city: 'Hunter', region: 'NY' } }))).toBe(
      'Hunter, NY',
    );
    expect(formatEventLocation(event({ venue: { city: 'Oslo', country: 'Norway' } }))).toBe(
      'Oslo, Norway',
    );
    expect(formatEventLocation(event({ venue: { region: 'CA' } }))).toBe('CA');
  });

  it('returns an empty string with no venue', () => {
    expect(formatEventLocation(event({}))).toBe('');
    expect(formatEventLocation(event({ venue: {} }))).toBe('');
  });
});

describe('isUpcoming', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-24T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('treats events with no dates or bad dates as upcoming', () => {
    expect(isUpcoming(event({}))).toBe(true);
    expect(isUpcoming(event({ startAt: 'garbage' }))).toBe(true);
  });

  it('uses the end date when present, otherwise the start date', () => {
    const past = '2026-09-20T00:00:00Z';
    expect(isUpcoming(event({ startAt: past, endAt: '2026-09-30T00:00:00Z' }))).toBe(true);
    expect(isUpcoming(event({ startAt: past, endAt: '2026-09-23T00:00:00Z' }))).toBe(false);
    expect(isUpcoming(event({ startAt: '2026-09-25T00:00:00Z' }))).toBe(true);
    expect(isUpcoming(event({ startAt: '2026-09-23T00:00:00Z' }))).toBe(false);
  });
});
