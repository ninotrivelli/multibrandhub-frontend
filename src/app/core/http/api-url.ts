import { environment } from '../../../environments/environment';

// Single definition of "is this request going to our backend". Interceptors
// that attach credentials or tenant headers must gate on this so secrets are
// never sent to third-party hosts (image CDNs, external APIs, etc.).
export function isApiRequest(url: string): boolean {
  return url === environment.apiBaseUrl || url.startsWith(`${environment.apiBaseUrl}/`);
}
