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

// MovementType in the backend is an integer-backed enum:
//   StockIn = 1, Sale = 2, Return = 3, Adjustment = 4, Shooting = 5, Loss = 6.
// We mirror it as a numeric union so JSON (de)serialization stays trivial.
export const MovementType = {
  StockIn: 1,
  Sale: 2,
  Return: 3,
  Adjustment: 4,
  Shooting: 5,
  Loss: 6,
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

export interface ProductCategoryResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
