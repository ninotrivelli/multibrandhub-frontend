import { ContractType } from '../brands/brands.types';

export type SettlementOperationalStatus = 'Draft' | 'Finalized' | 'Paid';

export type SettlementFinancialStatus = 'BrandOwesStore' | 'StoreOwesBrand' | 'BreakEven';

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface BrandSettlementSavedResponse {
  id: string;
  brandId: string;
  brandName: string;
  contractType: ContractType;
  from: string;
  to: string;
  fromInclusiveUtc: string;
  toExclusiveUtc: string;
  seriesId: string;
  versionNumber: number;
  isCurrent: boolean;
  supersededAtUtc: string | null;
  supersededBySettlementId: string | null;
  status: SettlementOperationalStatus;
  generatedAtUtc: string;
  generatedByUserId: string;
  generationNotes: string | null;
  finalizedAtUtc: string | null;
  finalizedByUserId: string | null;
  paidAtUtc: string | null;
  paidByUserId: string | null;
  paidAmount: number | null;
  paymentReference: string | null;
  paymentNotes: string | null;
  grossSalesAmount: number;
  returnsAmount: number;
  netSalesAmount: number;
  commissionPercentage: number;
  fixedRentCost: number;
  commissionAmount: number;
  fixedAmount: number;
  platformFee: number;
  cashCollectedByStore: number;
  nonCashCollectedByBrand: number;
  amountBrandOwesStore: number;
  settlementStatus: SettlementFinancialStatus;
  createdAt: string;
}

export interface GenerateBrandSettlementRequest {
  from: string;
  to: string;
  brandId?: string;
  notes?: string | null;
}

export interface SavedBrandSettlementSearchRequest {
  from?: string;
  to?: string;
  brandId?: string;
  status?: SettlementOperationalStatus;
  includeSuperseded?: boolean;
  page?: number;
  pageSize?: number;
}

export interface MarkBrandSettlementPaidRequest {
  paidAtUtc?: string;
  paymentReference?: string | null;
  notes?: string | null;
}
