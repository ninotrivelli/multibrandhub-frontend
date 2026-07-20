import { HttpErrorResponse } from '@angular/common/http';

export function retryAfterUtc(error: HttpErrorResponse, now = Date.now()): number | null {
  const raw = error.headers.get('Retry-After')?.trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    return now + Number(raw) * 1000;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) && parsed > now ? parsed : null;
}

export function retryAfterLabel(retryAtUtc: number, now = Date.now()): string {
  const remainingSeconds = Math.max(0, Math.ceil((retryAtUtc - now) / 1000));
  if (remainingSeconds < 60) return `${remainingSeconds} s`;

  const minutes = Math.ceil(remainingSeconds / 60);
  return `${minutes} min`;
}
