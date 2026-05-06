export type ContractType = 'CommissionOnly' | 'FixedRent' | 'Hybrid';

export type BrandStatus = 'Active' | 'Archived';

export interface BrandResponse {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contractType: ContractType;
  commissionPercentage: number;
  fixedRentCost: number;
  status: BrandStatus;
  archivedAtUtc: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandRequest {
  name: string;
  code: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contractType: ContractType;
  commissionPercentage: number;
  fixedRentCost: number;
}

export interface UpdateBrandRequest {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contractType: ContractType;
  commissionPercentage: number;
  fixedRentCost: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ListBrandsParams {
  page?: number;
  pageSize?: number;
  includeArchived?: boolean;
}

export interface BrandOffboardingResponse {
  brandId: string;
  brandName: string;
  status: BrandStatus;
  archivedAtUtc: string | null;
  productsArchived: number;
  usersDeactivated: number;
}
