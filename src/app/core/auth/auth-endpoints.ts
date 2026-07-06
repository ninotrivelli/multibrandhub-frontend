import { environment } from '../../../environments/environment';
import { isApiRequest } from '../http/api-url';

const ANONYMOUS_AUTH_PATHS = [
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
] as const;

export function isAnonymousAuthRequest(url: string): boolean {
  if (!isApiRequest(url)) return false;
  return ANONYMOUS_AUTH_PATHS.some((path) => url === `${environment.apiBaseUrl}${path}`);
}
