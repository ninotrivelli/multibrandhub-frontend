import { UserRole } from '../../../../../core/auth/auth.types';

export function isBrandRequiredForRole(role: UserRole): boolean {
  return role === 'BrandManager';
}

export function shouldShowBrandSelector(role: UserRole): boolean {
  return role === 'Admin' || role === 'BrandManager';
}

export function resolveBrandIdForUserRole(role: UserRole, brandId: string | null): string | null {
  return shouldShowBrandSelector(role) ? brandId : null;
}
