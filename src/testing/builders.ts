import {
  AuthResponse,
  AuthSession,
  AuthUser,
  JwtClaims,
  UserRole,
} from '../app/core/auth/auth.types';
import { BrandResponse, ContractType } from '../app/core/brands/brands.types';
import {
  SaleDetailResponse,
  SaleResponse,
  SaleSearchResponse,
  SalesDashboardResponse,
  SalesDashboardSaleResponse,
} from '../app/core/sales/sales.types';
import { StoreTaskResponse } from '../app/core/tasks/tasks.types';
import { UserResponse } from '../app/core/users/users.types';
import { ProductCategoryResponse } from '../app/core/product-categories/product-categories.types';
import {
  ImmobilizedStockProductResponse,
  MovementType,
  PagedResult,
  ProductResponse,
  StockMovementResponse,
} from '../app/features/shared/inventory/inventory.types';

export function paged<T>(items: T[], overrides: Partial<PagedResult<T>> = {}): PagedResult<T> {
  return {
    items,
    totalCount: items.length,
    page: 1,
    pageSize: Math.max(items.length, 1),
    ...overrides,
  };
}

export function makeJwt(claims: Partial<JwtClaims> = {}): string {
  const payload: JwtClaims = {
    sub: 'user-admin',
    email: 'admin@local.test',
    role: 'Admin',
    tenantId: 'tenant-default',
    brandId: 'brand-own',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    ...claims,
  };

  return `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url(payload)}.signature`;
}

export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: 'user-admin',
    fullName: 'Admin Local',
    email: 'admin@local.test',
    role: 'Admin',
    brandId: 'brand-own',
    ...overrides,
  };
}

export function makeAuthSession(
  overrides: Omit<Partial<AuthSession>, 'user'> & {
    user?: Partial<AuthUser>;
    claims?: Partial<JwtClaims>;
  } = {},
): AuthSession {
  const { user: userOverrides, claims, ...sessionOverrides } = overrides;
  const user = makeAuthUser(userOverrides);
  const tenantId = sessionOverrides.tenantId ?? 'tenant-default';
  const token = makeJwt({
    sub: user.userId,
    email: user.email,
    role: user.role,
    tenantId,
    brandId: user.brandId ?? undefined,
    ...claims,
  });

  return {
    user,
    tenantId,
    token,
    expiresAtUtc: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...sessionOverrides,
  };
}

export function makeAuthResponse(
  overrides: Partial<AuthResponse> & { role?: AuthResponse['role']; tenantId?: string } = {},
): AuthResponse {
  const { tenantId: tenantIdOverride, ...responseOverrides } = overrides;
  const role = responseOverrides.role ?? 'Admin';
  const userId = responseOverrides.userId ?? 'user-admin';
  const email = responseOverrides.email ?? 'admin@local.test';
  const brandId = responseOverrides.brandId ?? 'brand-own';
  const tenantId = tenantIdOverride ?? 'tenant-default';

  return {
    userId,
    fullName: 'Admin Local',
    email,
    role,
    brandId,
    token: makeJwt({
      sub: userId,
      email,
      role: typeof role === 'number' ? String(role) : role,
      tenantId,
      brandId: brandId ?? undefined,
    }),
    expiresAtUtc: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...responseOverrides,
  };
}

export function makeBrand(overrides: Partial<BrandResponse> = {}): BrandResponse {
  return {
    id: 'brand-own',
    name: 'Zendra',
    code: 'ZEND',
    logoUrl: null,
    contactEmail: 'zendra@local.test',
    contractType: 'Hybrid',
    commissionPercentage: 10,
    fixedRentCost: 1000,
    status: 'Active',
    archivedAtUtc: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeUser(overrides: Partial<UserResponse> = {}): UserResponse {
  const role: UserRole = overrides.role ?? 'Seller';
  return {
    id: 'user-seller',
    fullName: 'Venta Mostrador',
    email: 'seller@local.test',
    role,
    isActive: true,
    brandId: role === 'BrandManager' ? 'brand-a' : null,
    brandName: role === 'BrandManager' ? 'Lumina' : null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeStoreTask(overrides: Partial<StoreTaskResponse> = {}): StoreTaskResponse {
  return {
    id: 'task-1',
    description: 'Reponer perchas del mostrador',
    priority: 'Medium',
    status: 'Pending',
    scope: 'General',
    createdAt: '2026-06-01T10:00:00Z',
    createdByUserId: 'user-admin',
    createdByName: 'Admin Local',
    completedByUserId: null,
    completedByName: null,
    completedAtUtc: null,
    ...overrides,
  };
}

export function makeCategory(
  overrides: Partial<ProductCategoryResponse> = {},
): ProductCategoryResponse {
  return {
    id: 'cat-tops',
    name: 'Tops',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeProduct(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 'product-1',
    name: 'Buzo Oversize',
    sku: 'ZEND-BUZ-001',
    description: null,
    imageUrl: null,
    price: 1850,
    color: 'Negro',
    size: 'M',
    currentStock: 5,
    minStockAlert: 2,
    isActive: true,
    archivedAtUtc: null,
    brandId: 'brand-own',
    brandName: 'Zendra',
    categoryId: 'cat-tops',
    categoryName: 'Tops',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeImmobilizedProduct(
  overrides: Partial<ImmobilizedStockProductResponse> = {},
): ImmobilizedStockProductResponse {
  return {
    id: 'product-still',
    name: 'Camisa sin venta',
    sku: 'ZEND-CAM-001',
    imageUrl: null,
    price: 2200,
    color: 'Blanco',
    size: 'L',
    currentStock: 3,
    minStockAlert: 2,
    stockValue: 6600,
    brandId: 'brand-own',
    brandName: 'Zendra',
    categoryId: 'cat-shirts',
    categoryName: 'Camisas',
    lastSaleAtUtc: null,
    daysWithoutSales: 90,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeMovement(
  overrides: Partial<StockMovementResponse> = {},
): StockMovementResponse {
  const type: MovementType = overrides.type ?? MovementType.StockIn;
  return {
    id: 'movement-1',
    date: '2026-05-01T12:00:00Z',
    quantity: 3,
    type,
    observations: null,
    productId: 'product-1',
    productName: 'Buzo Oversize',
    brandId: 'brand-own',
    brandName: 'Zendra',
    userId: 'user-admin',
    userFullName: 'Admin Local',
    createdAt: '2026-05-01T12:00:00Z',
    ...overrides,
  };
}

export function makeSaleDetail(overrides: Partial<SaleDetailResponse> = {}): SaleDetailResponse {
  return {
    id: 'detail-1',
    productId: 'product-1',
    brandId: 'brand-own',
    originalSaleDetailId: null,
    productName: 'Buzo Oversize',
    brandName: 'Zendra',
    quantity: 2,
    unitPrice: 1850,
    discountType: 'None',
    discountValue: null,
    unitDiscountAmount: 0,
    unitNetPrice: 1850,
    subTotal: 3700,
    alreadyReturnedQuantity: 0,
    remainingReturnableQuantity: 2,
    ...overrides,
  };
}

export function makeSale(overrides: Partial<SaleResponse> = {}): SaleResponse {
  return {
    id: 'sale-1',
    ticketId: 'TCK-20260603-120000-AB12',
    date: '2026-06-03T12:00:00Z',
    type: 'Sale',
    totalAmount: 3700,
    paymentMethod: 'Cash',
    cardBrand: null,
    status: 'Completed',
    sellerId: 'user-seller',
    sellerName: 'Venta Mostrador',
    originalSaleId: null,
    details: [makeSaleDetail()],
    createdAt: '2026-06-03T12:00:00Z',
    observations: null,
    ...overrides,
  };
}

export function makeSaleSearch(overrides: Partial<SaleSearchResponse> = {}): SaleSearchResponse {
  return {
    id: 'sale-1',
    ticketId: 'TCK-20260603-120000-AB12',
    date: '2026-06-03T12:00:00Z',
    type: 'Sale',
    totalAmount: 3700,
    paymentMethod: 'Cash',
    cardBrand: null,
    status: 'Completed',
    sellerId: 'user-seller',
    sellerName: 'Venta Mostrador',
    createdAt: '2026-06-03T12:00:00Z',
    observations: null,
    brands: [{ brandId: 'brand-own', brandName: 'Zendra' }],
    ...overrides,
  };
}

export function makeSalesDashboardSale(
  overrides: Partial<SalesDashboardSaleResponse> = {},
): SalesDashboardSaleResponse {
  return {
    id: 'sale-1',
    ticketId: 'TCK-20260603-120000-AB12',
    date: '2026-06-03T12:00:00Z',
    type: 'Sale',
    totalAmount: 3700,
    paymentMethod: 'Cash',
    cardBrand: null,
    status: 'Completed',
    sellerId: 'user-seller',
    sellerName: 'Venta Mostrador',
    createdAt: '2026-06-03T12:00:00Z',
    observations: null,
    matchingAmount: 3700,
    ticketTotalAmount: 3700,
    brands: [{ brandId: 'brand-own', brandName: 'Zendra' }],
    ...overrides,
  };
}

export function makeSalesDashboard(
  overrides: Partial<SalesDashboardResponse> = {},
): SalesDashboardResponse {
  return {
    from: '2026-06-01',
    to: '2026-06-05',
    brandIds: ['brand-own'],
    chartWeekStart: '2026-06-01',
    kpis: {
      grossSalesAmount: 5000,
      returnsAmount: 500,
      netSalesAmount: 4500,
      saleTicketCount: 2,
      returnTicketCount: 1,
      unitsSold: 5,
      unitsReturned: 1,
      netUnits: 4,
      averageGrossTicketAmount: 2500,
      averageNetTicketAmount: 2250,
    },
    dailySales: [
      {
        date: '2026-06-01',
        grossSalesAmount: 3700,
        returnsAmount: 0,
        netSalesAmount: 3700,
      },
      {
        date: '2026-06-02',
        grossSalesAmount: 1300,
        returnsAmount: 500,
        netSalesAmount: 800,
      },
    ],
    brandDistribution: [
      {
        brandId: 'brand-own',
        brandName: 'Zendra',
        grossSalesAmount: 5000,
        returnsAmount: 500,
        netSalesAmount: 4500,
      },
    ],
    sales: paged([makeSalesDashboardSale()], { totalCount: 1, page: 1, pageSize: 10 }),
    ...overrides,
  };
}

export function makeBrandFormValue(
  overrides: {
    name?: string;
    code?: string;
    logoUrl?: string | null;
    contactEmail?: string | null;
    contractType?: ContractType;
    commissionPercentage?: number | null;
    fixedRentCost?: number | null;
  } = {},
) {
  return {
    name: ' Zendra ',
    code: ' zend ',
    logoUrl: ' ',
    contactEmail: ' marca@local.test ',
    contractType: 'Hybrid' as ContractType,
    commissionPercentage: 10,
    fixedRentCost: 1000,
    ...overrides,
  };
}

function base64Url(value: object): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
