import { PaymentMethod } from '../sales/sales.types';

export type CashRegisterSessionStatus = 'Open' | 'Closed';

export interface CashRegisterReconciliationLineResponse {
  id: string | null;
  brandId: string;
  brandName: string;
  paymentMethod: PaymentMethod;
  systemGrossSalesAmount: number;
  systemReturnsAmount: number;
  systemNetAmount: number;
  saleCount: number;
  returnCount: number;
  unitsSold: number;
  unitsReturned: number;
  netUnits: number;
  reportedAmount: number | null;
  varianceAmount: number | null;
}

export interface CashRegisterPaymentTotalResponse {
  paymentMethod: PaymentMethod;
  grossSalesAmount: number;
  returnsAmount: number;
  netAmount: number;
  reportedAmount: number | null;
  varianceAmount: number | null;
}

export interface CashRegisterBrandTotalResponse {
  brandId: string;
  brandName: string;
  grossSalesAmount: number;
  returnsAmount: number;
  netAmount: number;
  saleCount: number;
  returnCount: number;
  unitsSold: number;
  unitsReturned: number;
  netUnits: number;
}

export interface CashRegisterSessionResponse {
  id: string;
  status: CashRegisterSessionStatus;
  openedAtUtc: string;
  openedByUserId: string;
  openedByUserName: string | null;
  openingCashAmount: number;
  openingNotes: string | null;
  closedAtUtc: string | null;
  closedByUserId: string | null;
  closedByUserName: string | null;
  actualCashAmount: number | null;
  expectedCashAmount: number | null;
  cashVarianceAmount: number | null;
  closingNotes: string | null;
  grossSalesAmount: number;
  returnsAmount: number;
  netSalesAmount: number;
  saleCount: number;
  returnCount: number;
  paymentTotals: CashRegisterPaymentTotalResponse[];
  brandTotals: CashRegisterBrandTotalResponse[];
  reconciliationLines: CashRegisterReconciliationLineResponse[];
  createdAt: string;
}

export interface CashRegisterSessionSummaryResponse {
  id: string;
  status: CashRegisterSessionStatus;
  openedAtUtc: string;
  openedByUserId: string;
  openedByUserName: string | null;
  closedAtUtc: string | null;
  closedByUserId: string | null;
  closedByUserName: string | null;
  openingCashAmount: number;
  actualCashAmount: number | null;
  expectedCashAmount: number | null;
  cashVarianceAmount: number | null;
  grossSalesAmount: number;
  returnsAmount: number;
  netSalesAmount: number;
  saleCount: number;
  returnCount: number;
  createdAt: string;
}

export interface OpenCashRegisterRequest {
  openingCashAmount: number;
  notes?: string | null;
}

export interface CashRegisterReportedTotalRequest {
  brandId: string;
  paymentMethod: PaymentMethod;
  reportedAmount: number;
}

export interface CloseCashRegisterRequest {
  actualCashAmount: number;
  notes?: string | null;
  reportedTotals: CashRegisterReportedTotalRequest[];
}

export interface CashRegisterHistoryRequest {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}
