import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { UserRole } from './auth.types';

export const roleGuard = (allowed: UserRole[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.role();

  if (!role) return router.createUrlTree(['/login']);

  // SuperAdmin maps onto Admin permissions in the UI
  const effective: UserRole = role === 'SuperAdmin' ? 'Admin' : role;
  if (allowed.includes(effective)) return true;

  return router.createUrlTree([auth.homePathFor(role)]);
};
