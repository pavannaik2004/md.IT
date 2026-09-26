import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './time';

const NOW = Date.UTC(2026, 8, 26, 12, 0, 0);

describe('formatRelativeTime', () => {
  it.each([
    [NOW - 10_000, 'just now'],
    [NOW - 5 * 60_000, '5 min ago'],
    [NOW - 3 * 3_600_000, '3 h ago'],
    [NOW - 24 * 3_600_000, 'yesterday'],
    [NOW - 3 * 24 * 3_600_000, '3 days ago'],
  ])('formats %d', (timestamp, expected) => {
    expect(formatRelativeTime(timestamp, NOW)).toBe(expected);
  });

  it('uses a date for older times', () => {
    expect(formatRelativeTime(NOW - 30 * 24 * 3_600_000, NOW)).toMatch(/2026/);
  });

  it('treats future timestamps (clock skew) as just now', () => {
    expect(formatRelativeTime(NOW + 60_000, NOW)).toBe('just now');
  });
});
