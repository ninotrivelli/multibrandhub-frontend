import { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { isApiRequest } from '../http/api-url';

export const DEV_TENANT_HOST_STORAGE_KEY = 'mbh.devTenantHost';
export const TENANT_HOST_HEADER = 'X-Tenant-Host';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  if (environment.production || !isApiRequest(req.url)) {
    return next(req);
  }

  const tenantHost = localStorage.getItem(DEV_TENANT_HOST_STORAGE_KEY)?.trim();
  if (!tenantHost) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { [TENANT_HOST_HEADER]: tenantHost } }));
};
