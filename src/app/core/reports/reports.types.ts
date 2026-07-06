export type ReportExportType =
  | 'LocalMonthlyClose'
  | 'BrandSettlements'
  | 'SalesDetail'
  | 'BrandPerformance'
  | 'TopProducts'
  | 'InventoryValuation'
  | 'ImmobilizedStock'
  | 'StockAlerts'
  | 'StockMovements'
  | 'CashRegister'
  | 'StaffPerformance'
  | 'MyBrand';

export type ReportExportFilterKey =
  | 'From'
  | 'To'
  | 'BrandIds'
  | 'CategoryIds'
  | 'SellerIds'
  | 'PaymentMethods'
  | 'SaleStatuses'
  | 'MovementTypes'
  | 'StockStatuses'
  | 'ImmobilizedDays'
  | 'IncludeInactiveProducts';

export type ReportExportColumnDataType = 'string' | 'number' | 'money' | 'datetime' | 'boolean';

export type ReportPaymentMethod =
  | 'Cash'
  | 'CreditCard'
  | 'DebitCard'
  | 'Transfer'
  | 'MercadoPago';

export type ReportSaleStatus = 'Completed' | 'Canceled' | 'Pending' | 'Refunded';

export type ReportMovementType =
  | 'StockIn'
  | 'Sale'
  | 'Return'
  | 'Adjustment'
  | 'Loss'
  | 'PriceChange';

export type ReportStockStatus = 'InStock' | 'Critical' | 'OutOfStock';

export interface ReportExportRequest {
  reportType: ReportExportType;
  from: string;
  to: string;
  brandIds?: string[];
  categoryIds?: string[];
  sellerIds?: string[];
  paymentMethods?: ReportPaymentMethod[];
  saleStatuses?: ReportSaleStatus[];
  movementTypes?: ReportMovementType[];
  stockStatuses?: ReportStockStatus[];
  immobilizedDays?: number;
  includeInactiveProducts?: boolean;
}

export interface ReportExportColumnResponse {
  key: string;
  header: string;
  dataType: ReportExportColumnDataType;
}

export interface ReportExportTemplateResponse {
  reportType: ReportExportType;
  name: string;
  description: string;
  supportedFilters: ReportExportFilterKey[];
  columns: ReportExportColumnResponse[];
}

export interface ReportExportTemplatesResponse {
  templates: ReportExportTemplateResponse[];
  defaultImmobilizedDays: number;
  previewRowLimit: number;
  maxRows: number;
}

export type ReportExportPreviewRow = Record<string, unknown>;

export interface ReportExportPreviewResponse {
  reportType: ReportExportType;
  from: string;
  to: string;
  columns: ReportExportColumnResponse[];
  rows: ReportExportPreviewRow[];
  summary: Record<string, unknown>;
  calculatedAtUtc: string;
}
