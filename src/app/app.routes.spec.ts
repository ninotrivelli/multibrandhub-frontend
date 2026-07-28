import { Route } from '@angular/router';

import { routes } from './app.routes';

function flattenRoutes(entries: Route[]): Route[] {
  return entries.flatMap((route) => [route, ...flattenRoutes(route.children ?? [])]);
}

describe('app routes', () => {
  it(
    'resolves every lazy component declaration',
    async () => {
      const lazyRoutes = flattenRoutes(routes).filter((route) => route.loadComponent);

      expect(lazyRoutes.length).toBeGreaterThan(20);

      const components = await Promise.all(
        lazyRoutes.map((route) => Promise.resolve(route.loadComponent!())),
      );

      expect(components.every((component) => typeof component === 'function')).toBe(true);
    },
    15_000,
  );

  it('keeps role roots guarded and fallback routes redirected to login', () => {
    for (const path of ['admin', 'brand-manager', 'seller']) {
      const route = routes.find((candidate) => candidate.path === path);
      expect(route?.canActivate?.length).toBe(2);
      expect(route?.children?.some((child) => child.path === '')).toBe(true);
    }

    expect(routes.find((route) => route.path === '')?.redirectTo).toBe('/login');
    expect(routes.find((route) => route.path === '**')?.redirectTo).toBe('/login');
  });
});
