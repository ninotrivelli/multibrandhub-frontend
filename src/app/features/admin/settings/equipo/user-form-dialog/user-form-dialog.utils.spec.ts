import {
  isBrandRequiredForRole,
  resolveBrandIdForUserRole,
  shouldShowBrandSelector,
} from './user-form-dialog.utils';

describe('user form dialog utils', () => {
  it('requires a brand only for Marca users', () => {
    expect(isBrandRequiredForRole('BrandManager')).toBe(true);
    expect(isBrandRequiredForRole('Admin')).toBe(false);
    expect(isBrandRequiredForRole('Seller')).toBe(false);
  });

  it('shows brand selector only for Admin and Marca roles', () => {
    expect(shouldShowBrandSelector('Admin')).toBe(true);
    expect(shouldShowBrandSelector('BrandManager')).toBe(true);
    expect(shouldShowBrandSelector('Seller')).toBe(false);
    expect(shouldShowBrandSelector('SuperAdmin')).toBe(false);
  });

  it('clears brandId for roles that cannot be associated to a brand', () => {
    expect(resolveBrandIdForUserRole('BrandManager', 'brand-a')).toBe('brand-a');
    expect(resolveBrandIdForUserRole('Admin', 'brand-a')).toBe('brand-a');
    expect(resolveBrandIdForUserRole('Seller', 'brand-a')).toBeNull();
    expect(resolveBrandIdForUserRole('SuperAdmin', 'brand-a')).toBeNull();
  });

  it('allows optional brand association for Admin users', () => {
    expect(resolveBrandIdForUserRole('Admin', null)).toBeNull();
  });

  it('keeps BrandManager brand validation separate from payload resolution', () => {
    expect(isBrandRequiredForRole('BrandManager')).toBe(true);
    expect(resolveBrandIdForUserRole('BrandManager', null)).toBeNull();
  });
});
