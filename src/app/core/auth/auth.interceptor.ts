import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { isApiRequest } from '../http/api-url';
import { isAnonymousAuthRequest } from './auth-endpoints';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  // Only our own API ever sees the JWT — attaching it to third-party hosts
  // (image CDNs, external APIs) would leak the session token.
  if (!token || !isApiRequest(req.url) || isAnonymousAuthRequest(req.url)) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
