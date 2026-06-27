import { formatRelativeTimeAgo } from './settlements.utils';

describe('formatRelativeTimeAgo', () => {
  const now = new Date('2026-06-26T20:30:00Z');

  it('returns "recién" for timestamps under a minute old', () => {
    expect(formatRelativeTimeAgo('2026-06-26T20:29:30Z', now)).toBe('recién');
  });

  it('formats minutes', () => {
    expect(formatRelativeTimeAgo('2026-06-26T20:29:00Z', now)).toBe('hace 1 minuto');
    expect(formatRelativeTimeAgo('2026-06-26T20:25:00Z', now)).toBe('hace 5 minutos');
  });

  it('formats hours with optional minutes', () => {
    expect(formatRelativeTimeAgo('2026-06-26T18:30:00Z', now)).toBe('hace 2 h');
    expect(formatRelativeTimeAgo('2026-06-26T18:25:00Z', now)).toBe('hace 2 h 5 min');
  });

  it('formats days only', () => {
    expect(formatRelativeTimeAgo('2026-06-25T20:30:00Z', now)).toBe('hace 1 día');
    expect(formatRelativeTimeAgo('2026-06-23T20:30:00Z', now)).toBe('hace 3 días');
  });

  it('treats backend timestamps without a timezone designator as UTC', () => {
    // Same instant as 20:25:00Z but missing the trailing "Z" (how the backend sends it).
    expect(formatRelativeTimeAgo('2026-06-26T20:25:00', now)).toBe('hace 5 minutos');
  });
});
