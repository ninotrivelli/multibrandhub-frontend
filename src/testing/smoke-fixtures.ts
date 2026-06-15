import type { AuthSession, AuthUser, JwtClaims, UserRole } from '../app/core/auth/auth.types';
import type { BrandResponse } from '../app/core/brands/brands.types';
import type { UserResponse } from '../app/core/users/users.types';
import type { StoreProfileResponse } from '../app/core/store-profile/store-profile.types';
import type { ProductCategoryResponse } from '../app/core/product-categories/product-categories.types';
import type {
  CloseCashRegisterRequest,
  OpenCashRegisterRequest,
} from '../app/core/cash-register/cash-register.types';
import type { CreateStoreTaskRequest, StoreTaskResponse } from '../app/core/tasks/tasks.types';
import type {
  PagedResult,
  ProductResponse,
  StockMovementResponse,
} from '../app/features/shared/inventory/inventory.types';
import type { SaleResponse, SaleSearchResponse } from '../app/core/sales/sales.types';
import {
  makeAuthSession,
  makeBrand,
  makeCashRegisterSession,
  makeCashRegisterSummary,
  makeClosedCashRegisterSession,
  makeCategory,
  makeImmobilizedProduct,
  makeMovement,
  makeProduct,
  makeSale,
  makeSaleSearch,
  makeSalesDashboard,
  makeSalesDashboardSale,
  makeStoreTask,
  makeUser,
  paged,
} from './builders';

export const SMOKE_STORAGE_KEY = 'mbh.token';
export const SMOKE_TENANT_ID = 'tenant-smoke';
export const API_BASE_URL = 'https://localhost:7260/api';

export type SmokeRole = Extract<UserRole, 'Admin' | 'BrandManager' | 'Seller'>;

export interface SmokeApiRequest {
  method: string;
  url: string;
  postData?: string | null;
}

export interface SmokeApiResponse {
  status: number;
  body?: unknown;
}

const NOW = '2026-06-07T12:00:00Z';

const SMOKE_USERS_BY_ROLE: Record<SmokeRole, AuthUser> = {
  Admin: {
    userId: 'user-admin',
    fullName: 'Admin Local',
    email: 'admin@smoke.test',
    role: 'Admin',
    brandId: 'brand-own',
  },
  BrandManager: {
    userId: 'user-brand',
    fullName: 'Marca Responsable',
    email: 'marca@smoke.test',
    role: 'BrandManager',
    brandId: 'brand-a',
  },
  Seller: {
    userId: 'user-seller',
    fullName: 'Venta Mostrador',
    email: 'seller@smoke.test',
    role: 'Seller',
    brandId: null,
  },
};

export const smokeStoreProfile: StoreProfileResponse = {
  storeName: 'Local Smoke',
  address: 'Av. Siempre Viva 123',
  primaryPhone: '099 123 456',
  secondaryPhone: null,
  contactEmail: 'local@smoke.test',
  updatedAt: NOW,
};

export const smokeBrands: BrandResponse[] = [
  makeBrand({
    id: 'brand-own',
    name: 'Zendra',
    code: 'ZEND',
    contactEmail: 'zendra@smoke.test',
    commissionPercentage: 0,
    fixedRentCost: 0,
  }),
  makeBrand({
    id: 'brand-a',
    name: 'Lumina',
    code: 'LUM',
    contactEmail: 'lumina@smoke.test',
    commissionPercentage: 12,
    fixedRentCost: 1500,
  }),
];

export const smokeUsers: UserResponse[] = [
  makeUser({
    id: 'user-admin',
    fullName: 'Admin Local',
    email: 'admin@smoke.test',
    role: 'Admin',
    brandId: 'brand-own',
    brandName: 'Zendra',
  }),
  makeUser({
    id: 'user-brand',
    fullName: 'Marca Responsable',
    email: 'marca@smoke.test',
    role: 'BrandManager',
    brandId: 'brand-a',
    brandName: 'Lumina',
  }),
  makeUser({
    id: 'user-seller',
    fullName: 'Venta Mostrador',
    email: 'seller@smoke.test',
    role: 'Seller',
    brandId: null,
    brandName: null,
  }),
];

export const smokeCategories: ProductCategoryResponse[] = [
  makeCategory({ id: 'cat-tops', name: 'Tops' }),
  makeCategory({ id: 'cat-pants', name: 'Pantalones' }),
];

export const smokeProducts: ProductResponse[] = [
  makeProduct({
    id: 'product-zendra',
    name: 'Buzo Oversize',
    sku: 'ZEND-BUZ-001',
    currentStock: 5,
    minStockAlert: 2,
    brandId: 'brand-own',
    brandName: 'Zendra',
    categoryId: 'cat-tops',
    categoryName: 'Tops',
  }),
  makeProduct({
    id: 'product-lumina-critical',
    name: 'Camisa Serena',
    sku: 'LUM-CAM-002',
    currentStock: 1,
    minStockAlert: 2,
    brandId: 'brand-a',
    brandName: 'Lumina',
    categoryId: 'cat-tops',
    categoryName: 'Tops',
  }),
  makeProduct({
    id: 'product-lumina-out',
    name: 'Pantalón Alba',
    sku: 'LUM-PAN-003',
    currentStock: 0,
    minStockAlert: 1,
    brandId: 'brand-a',
    brandName: 'Lumina',
    categoryId: 'cat-pants',
    categoryName: 'Pantalones',
  }),
];

export const smokeMovements: StockMovementResponse[] = [
  makeMovement({
    id: 'movement-in',
    productId: 'product-zendra',
    productName: 'Buzo Oversize',
    brandId: 'brand-own',
    brandName: 'Zendra',
    userId: 'user-admin',
    userFullName: 'Admin Local',
    quantity: 3,
  }),
  makeMovement({
    id: 'movement-sale',
    productId: 'product-lumina-critical',
    productName: 'Camisa Serena',
    brandId: 'brand-a',
    brandName: 'Lumina',
    userId: 'user-seller',
    userFullName: 'Venta Mostrador',
    quantity: -1,
    type: 'Sale',
  }),
];

export const smokeTasks: StoreTaskResponse[] = [
  makeStoreTask({
    id: 'task-general-high',
    description: 'Reponer bolsas del mostrador',
    priority: 'High',
    scope: 'General',
    createdByUserId: 'user-admin',
    createdByName: 'Admin Local',
  }),
  makeStoreTask({
    id: 'task-personal-admin',
    description: 'Revisar liquidaciones de la semana',
    priority: 'Medium',
    scope: 'Personal',
    createdByUserId: 'user-admin',
    createdByName: 'Admin Local',
  }),
  makeStoreTask({
    id: 'task-completed',
    description: 'Ordenar percheros del frente',
    priority: 'Low',
    status: 'Completed',
    scope: 'General',
    completedByUserId: 'user-seller',
    completedByName: 'Venta Mostrador',
    completedAtUtc: NOW,
  }),
];

export const smokeRecentSales: SaleSearchResponse[] = [
  makeSaleSearch({
    id: 'sale-smoke',
    ticketId: 'TCK-SMOKE-001',
    sellerId: 'user-seller',
    sellerName: 'Venta Mostrador',
    brands: [
      { brandId: 'brand-own', brandName: 'Zendra' },
      { brandId: 'brand-a', brandName: 'Lumina' },
    ],
  }),
];

const smokeDashboardSales = [
  makeSalesDashboardSale({
    id: 'sale-smoke',
    ticketId: 'TCK-SMOKE-001',
    sellerId: 'user-seller',
    sellerName: 'Venta Mostrador',
    brands: [
      { brandId: 'brand-own', brandName: 'Zendra' },
      { brandId: 'brand-a', brandName: 'Lumina' },
    ],
  }),
];

export const smokeSale: SaleResponse = makeSale({
  id: 'sale-smoke',
  ticketId: 'TCK-SMOKE-001',
  sellerId: 'user-seller',
  sellerName: 'Venta Mostrador',
});

export const smokeClosedCashRegister = makeClosedCashRegisterSession({
  id: 'cash-smoke-closed',
  openedByUserId: 'user-seller',
  openedByUserName: 'Venta Mostrador',
  closedByUserId: 'user-admin',
  closedByUserName: 'Admin Local',
});

export const smokeCashRegisterSummary = makeCashRegisterSummary({
  id: smokeClosedCashRegister.id,
  openedByUserId: smokeClosedCashRegister.openedByUserId,
  openedByUserName: smokeClosedCashRegister.openedByUserName,
  closedByUserId: smokeClosedCashRegister.closedByUserId,
  closedByUserName: smokeClosedCashRegister.closedByUserName,
  openedAtUtc: smokeClosedCashRegister.openedAtUtc,
  closedAtUtc: smokeClosedCashRegister.closedAtUtc,
  openingCashAmount: smokeClosedCashRegister.openingCashAmount,
  actualCashAmount: smokeClosedCashRegister.actualCashAmount,
  expectedCashAmount: smokeClosedCashRegister.expectedCashAmount,
  cashVarianceAmount: smokeClosedCashRegister.cashVarianceAmount,
  grossSalesAmount: smokeClosedCashRegister.grossSalesAmount,
  returnsAmount: smokeClosedCashRegister.returnsAmount,
  netSalesAmount: smokeClosedCashRegister.netSalesAmount,
  saleCount: smokeClosedCashRegister.saleCount,
  returnCount: smokeClosedCashRegister.returnCount,
});

export function makeSmokeSession(role: SmokeRole): AuthSession {
  const user = SMOKE_USERS_BY_ROLE[role];
  return makeAuthSession({
    tenantId: SMOKE_TENANT_ID,
    user,
    claims: matchingClaimsFor(user),
  });
}

export function resolveSmokeApiResponse(request: SmokeApiRequest): SmokeApiResponse | null {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const path = url.pathname;

  if (method === 'OPTIONS' && path.startsWith('/api/')) {
    return { status: 204 };
  }

  if (method === 'GET' && path === '/api/store-profile') {
    return { status: 200, body: smokeStoreProfile };
  }
  if (method === 'GET' && path === '/api/brands') {
    return { status: 200, body: page(smokeBrands, url) };
  }
  if (method === 'GET' && path === '/api/users') {
    return { status: 200, body: page(smokeUsers, url) };
  }
  if (method === 'GET' && path === '/api/product-categories') {
    return { status: 200, body: smokeCategories };
  }
  if (method === 'GET' && path === '/api/products/search') {
    return { status: 200, body: page(filterProducts(url), url) };
  }
  if (method === 'GET' && path === '/api/products/immobilized-stock') {
    return {
      status: 200,
      body: page(
        [
          makeImmobilizedProduct({
            id: 'product-still',
            name: 'Camisa sin venta',
            brandId: 'brand-a',
            brandName: 'Lumina',
          }),
        ],
        url,
      ),
    };
  }
  if (method === 'GET' && path === '/api/stock-movements') {
    return { status: 200, body: page(smokeMovements, url) };
  }
  if (method === 'GET' && path === '/api/StoreTasks') {
    return { status: 200, body: page(filterTasks(url), url) };
  }
  if (method === 'POST' && path === '/api/StoreTasks') {
    const payload = parseJson<CreateStoreTaskRequest>(request.postData);
    return {
      status: 201,
      body: makeStoreTask({
        id: 'task-created-smoke',
        description: payload.description,
        priority: payload.priority,
        scope: payload.scope,
        createdAt: NOW,
      }),
    };
  }
  if (method === 'PATCH' && path.match(/^\/api\/StoreTasks\/[^/]+\/complete$/)) {
    return { status: 204 };
  }
  if (method === 'GET' && path === '/api/sales/search') {
    return { status: 200, body: page(smokeRecentSales, url) };
  }
  if (method === 'GET' && path === '/api/sales/sale-smoke') {
    return { status: 200, body: smokeSale };
  }
  if (method === 'GET' && path === '/api/reports/sales/dashboard') {
    return {
      status: 200,
      body: makeSalesDashboard({
        brandIds: url.searchParams.getAll('brandIds'),
        sales: page(smokeDashboardSales, url),
      }),
    };
  }
  if (method === 'POST' && path === '/api/sales') {
    return { status: 200, body: smokeSale };
  }
  if (method === 'GET' && path === '/api/cash-register/current') {
    return { status: 200, body: null };
  }
  if (method === 'GET' && path === '/api/cash-register/history') {
    return { status: 200, body: page([smokeCashRegisterSummary], url) };
  }
  if (method === 'GET' && path === `/api/cash-register/${smokeClosedCashRegister.id}`) {
    return { status: 200, body: smokeClosedCashRegister };
  }
  if (method === 'POST' && path === '/api/cash-register/open') {
    const payload = parseJson<OpenCashRegisterRequest>(request.postData);
    return {
      status: 201,
      body: makeCashRegisterSession({
        id: 'cash-smoke-open',
        openedByUserId: 'user-seller',
        openedByUserName: 'Venta Mostrador',
        openingCashAmount: payload.openingCashAmount,
        openingNotes: payload.notes ?? null,
      }),
    };
  }
  if (method === 'POST' && path.match(/^\/api\/cash-register\/[^/]+\/close$/)) {
    const payload = parseJson<CloseCashRegisterRequest>(request.postData);
    return {
      status: 200,
      body: makeClosedCashRegisterSession({
        id: path.split('/')[3],
        actualCashAmount: payload.actualCashAmount,
        closingNotes: payload.notes ?? null,
      }),
    };
  }
  if (method === 'PATCH' && path.match(/^\/api\/users\/[^/]+\/password$/)) {
    return { status: 204 };
  }

  return null;
}

function matchingClaimsFor(user: AuthUser): Partial<JwtClaims> {
  return {
    sub: user.userId,
    email: user.email,
    role: user.role,
    tenantId: SMOKE_TENANT_ID,
    brandId: user.brandId ?? undefined,
  };
}

function filterProducts(url: URL): ProductResponse[] {
  const search = url.searchParams.get('searchTerm')?.trim().toLowerCase();
  const brandId = url.searchParams.get('brandId');
  const categoryId = url.searchParams.get('categoryId');
  const stockStatuses = [
    ...url.searchParams.getAll('stockStatuses'),
    url.searchParams.get('stockStatus'),
  ].filter(Boolean);

  return smokeProducts.filter((product) => {
    if (brandId && product.brandId !== brandId) return false;
    if (categoryId && product.categoryId !== categoryId) return false;
    if (search && !`${product.name} ${product.sku}`.toLowerCase().includes(search)) return false;
    if (
      stockStatuses.length > 0 &&
      !stockStatuses.some((status) => matchesStockStatus(product, status!))
    ) {
      return false;
    }
    return true;
  });
}

function matchesStockStatus(product: ProductResponse, status: string): boolean {
  if (status === 'OutOfStock') return product.currentStock === 0;
  if (status === 'Critical') {
    return product.currentStock > 0 && product.currentStock <= product.minStockAlert;
  }
  if (status === 'InStock') return product.currentStock > product.minStockAlert;
  return true;
}

function filterTasks(url: URL): StoreTaskResponse[] {
  const status = url.searchParams.get('status') ?? url.searchParams.get('Status');
  const scope = url.searchParams.get('scope') ?? url.searchParams.get('Scope');

  return smokeTasks.filter((task) => {
    if (status && task.status !== status) return false;
    if (scope && task.scope !== scope) return false;
    return true;
  });
}

function page<T>(items: T[], url: URL): PagedResult<T> {
  const requestedPage = Number(url.searchParams.get('page') ?? 1);
  const pageSize = Number(url.searchParams.get('pageSize') ?? Math.max(items.length, 1));
  const start = (requestedPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return paged(pageItems, {
    totalCount: items.length,
    page: requestedPage,
    pageSize,
  });
}

function parseJson<T>(value: string | null | undefined): T {
  return JSON.parse(value ?? '{}') as T;
}
