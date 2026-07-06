import { jwtDecode } from 'jwt-decode';

import { JwtClaims } from '../app/core/auth/auth.types';
import {
  API_BASE_URL,
  SMOKE_TENANT_ID,
  makeSmokeSession,
  resolveSmokeApiResponse,
} from './smoke-fixtures';

describe('smoke-fixtures', () => {
  it('creates restorable auth sessions for every smoke role', () => {
    for (const role of ['Admin', 'BrandManager', 'Seller'] as const) {
      const session = makeSmokeSession(role);
      const claims = jwtDecode<JwtClaims>(session.token);

      expect(session.tenantId).toBe(SMOKE_TENANT_ID);
      expect(claims.tenantId).toBe(session.tenantId);
      expect(claims.sub).toBe(session.user.userId);
      expect(claims.email).toBe(session.user.email);
      expect(claims.role).toBe(session.user.role);
      expect(claims.brandId ?? null).toBe(session.user.brandId);
      expect((claims.exp ?? 0) * 1000).toBeGreaterThan(Date.now());
    }
  });

  it('resolves every declared smoke API endpoint and rejects unknown calls', () => {
    const declared = [
      ['GET', '/store-profile'],
      ['GET', '/brands'],
      ['GET', '/users'],
      ['GET', '/product-categories'],
      ['GET', '/products/search'],
      ['GET', '/products/immobilized-stock'],
      ['GET', '/stock-movements'],
      ['GET', '/sales/search'],
      ['GET', '/reports/sales/dashboard'],
      ['GET', '/reports/sales/summary'],
      ['GET', '/reports/sales/top-products'],
      ['GET', '/reports/exports/templates'],
      ['POST', '/reports/exports/preview'],
      ['GET', '/settlements/brands/brand-a'],
      ['POST', '/sales'],
      ['GET', '/cash-register/current'],
      ['GET', '/cash-register/history'],
      ['GET', '/cash-register/cash-smoke-closed'],
      ['POST', '/cash-register/open'],
      ['POST', '/cash-register/cash-smoke-open/movements'],
      ['POST', '/cash-register/cash-smoke-open/close'],
      ['PATCH', '/users/user-admin/password'],
    ] as const;

    for (const [method, path] of declared) {
      expect(resolveSmokeApiResponse({ method, url: `${API_BASE_URL}${path}` })).not.toBeNull();
    }

    expect(
      resolveSmokeApiResponse({ method: 'GET', url: `${API_BASE_URL}/not-mocked` }),
    ).toBeNull();
  });

  it('applies important product search filters used by role-specific screens', () => {
    const brandScoped = resolveSmokeApiResponse({
      method: 'GET',
      url: `${API_BASE_URL}/products/search?brandId=brand-a&page=1&pageSize=100`,
    });
    const critical = resolveSmokeApiResponse({
      method: 'GET',
      url: `${API_BASE_URL}/products/search?stockStatus=Critical&page=1&pageSize=100`,
    });

    expect((brandScoped?.body as { totalCount: number }).totalCount).toBe(2);
    expect((critical?.body as { totalCount: number }).totalCount).toBe(1);
  });
});
