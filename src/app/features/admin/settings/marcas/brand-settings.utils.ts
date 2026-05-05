import { UserResponse } from '../equipo/users.types';
import {
  BrandResponse,
  ContractType,
  CreateBrandRequest,
  UpdateBrandRequest,
} from './brands.types';

export interface BrandFormValue {
  name: string;
  code: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contractType: ContractType;
  commissionPercentage: number | null;
  fixedRentCost: number | null;
}

export function sortBrandsForUser(
  brands: readonly BrandResponse[],
  currentBrandId: string | null | undefined,
): BrandResponse[] {
  return [...brands].sort((a, b) => {
    const aIsOwn = a.id === currentBrandId;
    const bIsOwn = b.id === currentBrandId;
    if (aIsOwn !== bIsOwn) return aIsOwn ? -1 : 1;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });
}

export function hasAssociatedActiveUser(brandId: string, users: readonly UserResponse[]): boolean {
  return users.some(
    (user) =>
      (user.role === 'BrandManager' || user.role === 'Admin') &&
      user.isActive &&
      user.brandId === brandId,
  );
}

export function agreementAmountsForContract(
  value: BrandFormValue,
): Pick<CreateBrandRequest, 'commissionPercentage' | 'fixedRentCost'> {
  const commissionPercentage =
    value.contractType === 'FixedRent' ? 0 : Number(value.commissionPercentage ?? 0);
  const fixedRentCost =
    value.contractType === 'CommissionOnly' ? 0 : Number(value.fixedRentCost ?? 0);

  return { commissionPercentage, fixedRentCost };
}

export function buildCreateBrandRequest(value: BrandFormValue): CreateBrandRequest {
  return {
    name: value.name.trim(),
    code: value.code.trim().toUpperCase(),
    logoUrl: nullableTrim(value.logoUrl),
    contactEmail: nullableTrim(value.contactEmail),
    contractType: value.contractType,
    ...agreementAmountsForContract(value),
  };
}

export function buildUpdateBrandRequest(value: BrandFormValue): UpdateBrandRequest {
  return {
    name: value.name.trim(),
    logoUrl: nullableTrim(value.logoUrl),
    contactEmail: nullableTrim(value.contactEmail),
    contractType: value.contractType,
    ...agreementAmountsForContract(value),
  };
}

function nullableTrim(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
