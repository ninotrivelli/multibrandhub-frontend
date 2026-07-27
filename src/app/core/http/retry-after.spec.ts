import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { retryAfterLabel, retryAfterUtc } from './retry-after';

describe('Retry-After helpers', () => {
  const now = Date.parse('2026-07-20T18:00:00Z');

  it('parses delta seconds and HTTP dates', () => {
    const delta = new HttpErrorResponse({
      status: 429,
      headers: new HttpHeaders({ 'Retry-After': '90' }),
    });
    expect(retryAfterUtc(delta, now)).toBe(now + 90_000);

    const date = new HttpErrorResponse({
      status: 429,
      headers: new HttpHeaders({ 'Retry-After': 'Mon, 20 Jul 2026 18:03:00 GMT' }),
    });
    expect(retryAfterUtc(date, now)).toBe(now + 180_000);
  });

  it('ignores absent, invalid, or already expired values and formats countdowns', () => {
    expect(retryAfterUtc(new HttpErrorResponse({ status: 429 }), now)).toBeNull();
    expect(
      retryAfterUtc(
        new HttpErrorResponse({ headers: new HttpHeaders({ 'Retry-After': 'invalid' }) }),
        now,
      ),
    ).toBeNull();
    expect(retryAfterLabel(now + 45_000, now)).toBe('45 s');
    expect(retryAfterLabel(now + 61_000, now)).toBe('2 min');
  });
});
