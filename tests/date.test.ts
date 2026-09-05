import { describe, expect, it } from 'vitest';
import { dateOnly, dueIsUrgent, formatDue, isRecentDone, toPocketBaseDate } from '../src/lib/date';

describe('day-only due dates', () => {
  const today = new Date(2026, 8, 5, 12);

  it('round-trips without applying a timezone offset', () => {
    expect(toPocketBaseDate('2026-09-05')).toBe('2026-09-05 00:00:00.000Z');
    expect(dateOnly('2026-09-05 00:00:00.000Z')).toBe('2026-09-05');
  });

  it('formats relative dates and marks only today or the past urgent', () => {
    expect(formatDue('2026-09-05', today)).toBe('heute');
    expect(formatDue('2026-09-06', today)).toBe('morgen');
    expect(dueIsUrgent('2026-09-04', today)).toBe(true);
    expect(dueIsUrgent('2026-09-06', today)).toBe(false);
  });
});

describe('finished-card window', () => {
  const now = new Date('2026-09-05T12:00:00Z').getTime();

  it('includes the exact 14-day boundary', () => {
    expect(isRecentDone(new Date(now - 14 * 86_400_000).toISOString(), now)).toBe(true);
    expect(isRecentDone(new Date(now - 14 * 86_400_000 - 1).toISOString(), now)).toBe(false);
  });
});
