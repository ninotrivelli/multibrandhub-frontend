// Mirrors the backend contract under MultiBrandHub.Application.Products and
// MultiBrandHub.Application.StockMovements. Keep field names in sync if the
// backend records change.

export type ProductStockStatus = 'InStock' | 'Critical' | 'OutOfStock';

// Frontend-only label used by the table's status column.
export type StockStatusLabel = 'OK' | 'Crítico' | 'Agotado';

export interface ProductResponse {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  color: string | null;
  size: string | null;
  currentStock: number;
  minStockAlert: number;
  isActive: boolean;
  archivedAtUtc: string | null;
  brandId: string;
  brandName: string | null;
  categoryId: string;
  categoryName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  color: string | null;
  size: string | null;
  currentStock: number;
  minStockAlert: number | null;
  brandId: string;
  categoryId: string;
}

export interface UpdateProductRequest {
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  color: string | null;
  size: string | null;
  minStockAlert: number;
  categoryId: string;
}

export interface ProductSearchParams {
  searchTerm?: string;
  brandId?: string;
  categoryId?: string;
  color?: string;
  size?: string;
  stockStatus?: ProductStockStatus;
  onlyInStock?: boolean;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// MovementType in the backend is an integer-backed enum (StockIn=1 ... Loss=6),
// but the API uses JsonStringEnumConverter globally, so the wire format is the
// enum's *name* — e.g. "StockIn", "Sale". We mirror that string union here.
// JsonStringEnumConverter accepts both names and integers on input, so sending
// these strings on POST is fine.
export const MovementType = {
  StockIn: 'StockIn',
  Sale: 'Sale',
  Return: 'Return',
  Adjustment: 'Adjustment',
  Shooting: 'Shooting',
  Loss: 'Loss',
} as const;

export type MovementType = (typeof MovementType)[keyof typeof MovementType];

export interface StockMovementResponse {
  id: string;
  date: string;
  quantity: number;
  type: MovementType;
  observations: string | null;
  productId: string;
  productName: string | null;
  brandId: string | null;
  brandName: string | null;
  userId: string | null;
  userFullName: string | null;
  createdAt: string;
}

export interface CreateStockMovementRequest {
  productId: string;
  quantity: number;
  type: MovementType;
  observations: string | null;
  userId: string | null;
}

export interface StockMovementSearchParams {
  productId?: string;
  brandId?: string;
  type?: MovementType;
  // ISO local date (YYYY-MM-DD). Backend strips the time portion.
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface StockMovementTodaySummary {
  totalCount: number;
  inboundUnits: number;
  outboundUnits: number;
}

export interface ProductCategoryResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
