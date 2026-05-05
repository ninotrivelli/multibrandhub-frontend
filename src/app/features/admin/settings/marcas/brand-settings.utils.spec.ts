import { UserResponse } from '../equipo/users.types';
import {
  buildCreateBrandRequest,
  hasAssociatedActiveUser,
  sortBrandsForUser,
} from './brand-settings.utils';
import { BrandResponse } from './brands.types';

const baseBrand: BrandResponse = {
  id: 'brand-a',
  name: 'Zendra',
  code: 'ZENDRA',
  logoUrl: null,
  contactEmail: null,
  contractType: 'Hybrid',
  commissionPercentage: 10,
  fixedRentCost: 1000,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const baseUser: UserResponse = {
  id: 'user-a',
  fullName: 'Marca Uno',
  email: 'marca@test.com',
  role: 'BrandManager',
  isActive: true,
  brandId: 'brand-a',
  brandName: 'Zendra',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('brand settings utils', () => {
  it('sorts the current admin brand first, then alphabetically', () => {
    const brands: BrandResponse[] = [
      { ...baseBrand, id: 'brand-b', name: 'Zendra' },
      { ...baseBrand, id: 'brand-own', name: 'Kora' },
      { ...baseBrand, id: 'brand-c', name: 'Bohemia' },
    ];

    expect(sortBrandsForUser(brands, 'brand-own').map((brand) => brand.id)).toEqual([
      'brand-own',
      'brand-c',
      'brand-b',
    ]);
  });

  it('counts active Admin or BrandManager users as associated brand users', () => {
    const users: UserResponse[] = [
      { ...baseUser, role: 'Admin', brandId: 'brand-admin' },
      { ...baseUser, id: 'inactive-brand', isActive: false, brandId: 'brand-a' },
      { ...baseUser, id: 'active-other-brand', brandId: 'brand-b' },
      { ...baseUser, id: 'seller', role: 'Seller', brandId: 'brand-a' },
    ];

    expect(hasAssociatedActiveUser('brand-admin', users)).toBe(true);
    expect(hasAssociatedActiveUser('brand-b', users)).toBe(true);
    expect(hasAssociatedActiveUser('brand-a', users)).toBe(false);
  });

  it('normalizes create payload amounts by contract type', () => {
    expect(
      buildCreateBrandRequest({
        name: ' Nueva Marca ',
        code: 'nueva_01',
        logoUrl: '',
        contactEmail: ' marca@test.com ',
        contractType: 'CommissionOnly',
        commissionPercentage: 15,
        fixedRentCost: 3000,
      }),
    ).toEqual({
      name: 'Nueva Marca',
      code: 'NUEVA_01',
      logoUrl: null,
      contactEmail: 'marca@test.com',
      contractType: 'CommissionOnly',
      commissionPercentage: 15,
      fixedRentCost: 0,
    });

    expect(
      buildCreateBrandRequest({
        name: 'Renta',
        code: 'RENTA',
        logoUrl: null,
        contactEmail: null,
        contractType: 'FixedRent',
        commissionPercentage: 20,
        fixedRentCost: 4000,
      }).commissionPercentage,
    ).toBe(0);
  });
});
