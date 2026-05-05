export type ContractType = 'CommissionOnly' | 'FixedRent' | 'Hybrid';

export interface BrandResponse {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contractType: ContractType;
  commissionPercentage: number;
  fixedRentCost: number;
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
}
