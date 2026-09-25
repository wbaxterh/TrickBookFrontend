import { formatNumber, formatTimeAgo, resolveAssetUrl } from '@/lib/utils';

describe('formatNumber', () => {
  it('leaves small numbers alone', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
  });

  it('abbreviates thousands and drops a trailing .0', () => {
    expect(formatNumber(1000)).toBe('1K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(999999)).toBe('1000K');
  });

  it('abbreviates millions', () => {
    expect(formatNumber(1000000)).toBe('1M');
    expect(formatNumber(2340000)).toBe('2.3M');
  });
});

describe('formatTimeAgo', () => {
  const NOW = new Date('2026-09-24T12:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

  it('reports "now" inside the first minute', () => {
    expect(formatTimeAgo(NOW)).toBe('now');
    expect(formatTimeAgo(new Date(NOW.getTime() - 30_000))).toBe('now');
  });

  it('scales through minutes, hours, days, weeks and months', () => {
    expect(formatTimeAgo(minutesAgo(5))).toBe('5m ago');
    expect(formatTimeAgo(minutesAgo(3 * 60))).toBe('3h ago');
    expect(formatTimeAgo(minutesAgo(2 * 24 * 60))).toBe('2d ago');
    expect(formatTimeAgo(minutesAgo(15 * 24 * 60))).toBe('2w ago');
    expect(formatTimeAgo(minutesAgo(65 * 24 * 60))).toBe('2mo ago');
  });

  it('accepts ISO strings as well as Date objects', () => {
    expect(formatTimeAgo(minutesAgo(10).toISOString())).toBe('10m ago');
  });
});

describe('resolveAssetUrl', () => {
  it('returns undefined for empty input', () => {
    expect(resolveAssetUrl(undefined)).toBeUndefined();
    expect(resolveAssetUrl(null)).toBeUndefined();
    expect(resolveAssetUrl('')).toBeUndefined();
    expect(resolveAssetUrl('   ')).toBeUndefined();
  });

  it('passes absolute http, https and data URLs through untouched', () => {
    expect(resolveAssetUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(resolveAssetUrl('http://cdn.example.com/a.jpg')).toBe('http://cdn.example.com/a.jpg');
    expect(resolveAssetUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });

  it('prefixes root-relative website paths with the published site origin', () => {
    expect(resolveAssetUrl('/images/trickipedia/bmx-180.jpg')).toBe(
      'https://thetrickbook.com/images/trickipedia/bmx-180.jpg',
    );
  });

  it('trims whitespace but leaves other relative references alone', () => {
    expect(resolveAssetUrl('  /images/a.jpg ')).toBe('https://thetrickbook.com/images/a.jpg');
    expect(resolveAssetUrl('images/a.jpg')).toBe('images/a.jpg');
  });
});
