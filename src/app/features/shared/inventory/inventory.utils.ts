import { MovementType, ProductResponse, StockStatusLabel } from './inventory.types';

// Map the seed category names to the matching placeholder PNG under
// `public/images/placeholders/categories/`. Backend always seeds these
// 22 names, so the lookup is safe to hardcode. Casing matches the actual
// files on disk (note `Swimwear.png` and the accented `pañuelos.png`).
const CATEGORY_PLACEHOLDER_BY_NAME: Record<string, string> = {
  'Anillos': 'anillos.png',
  'Aros y caravanas': 'aros-y-caravanas.png',
  'Pulseras': 'pulseras.png',
  'Collares y gargantillas': 'collares-y-gargantillas.png',
  'Piedras Naturales': 'piedras-naturales.png',
  'Gorros': 'gorros.png',
  'Pañuelos': 'pañuelos.png',
  'Cinturones': 'cinturones.png',
  'Otros': 'otros.png',
  'Bolsos': 'bolsos.png',
  'Lentes': 'lentes.png',
  'Shorts': 'shorts.png',
  'Camisas': 'camisas.png',
  'Remeras': 'remeras.png',
  'Swimwear': 'Swimwear.png',
  'Blusas': 'blusas.png',
  'Tops': 'tops.png',
  'Sweaters': 'sweaters.png',
  'Sacos': 'sacos.png',
  'Vestidos': 'vestidos.png',
  'Faldas': 'faldas.png',
  'Pantalones': 'pantalones.png',
};

const PLACEHOLDER_BASE = '/images/placeholders/categories';
const FALLBACK_PLACEHOLDER = `${PLACEHOLDER_BASE}/otros.png`;

export function categoryPlaceholderUrl(categoryName: string | null | undefined): string {
  if (!categoryName) return FALLBACK_PLACEHOLDER;
  const file = CATEGORY_PLACEHOLDER_BY_NAME[categoryName];
  return file ? `${PLACEHOLDER_BASE}/${file}` : FALLBACK_PLACEHOLDER;
}

export function resolveProductImageUrl(product: {
  imageUrl: string | null;
  categoryName: string | null;
}): string {
  if (product.imageUrl && product.imageUrl.trim().length > 0) return product.imageUrl;
  return categoryPlaceholderUrl(product.categoryName);
}

export function computeStockStatus(stock: number, minAlert: number): StockStatusLabel {
  if (stock <= 0) return 'Agotado';
  if (stock <= minAlert) return 'Crítico';
  return 'OK';
}

const MOVEMENT_LABELS: Record<MovementType, string> = {
  [MovementType.StockIn]: 'Ingreso',
  [MovementType.Sale]: 'Venta',
  [MovementType.Return]: 'Devolución',
  [MovementType.Adjustment]: 'Ajuste',
  [MovementType.Shooting]: 'Sesión de fotos',
  [MovementType.Loss]: 'Egreso',
};

export function movementTypeLabel(type: MovementType): string {
  return MOVEMENT_LABELS[type] ?? 'Movimiento';
}

const MOVEMENT_SEVERITY: Record<MovementType, 'success' | 'danger' | 'info' | 'warn' | 'secondary'> = {
  [MovementType.StockIn]: 'success',
  [MovementType.Sale]: 'info',
  [MovementType.Return]: 'success',
  [MovementType.Adjustment]: 'warn',
  [MovementType.Shooting]: 'secondary',
  [MovementType.Loss]: 'danger',
};

export function movementTypeSeverity(
  type: MovementType,
): 'success' | 'danger' | 'info' | 'warn' | 'secondary' {
  return MOVEMENT_SEVERITY[type] ?? 'secondary';
}

export function formatCurrencyUYU(value: number): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-UY').format(value);
}

export function formatMovementDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Orders products: own brand first (when known), then alphabetically.
export function sortProductsForUser(
  products: readonly ProductResponse[],
  ownBrandId: string | null | undefined,
): ProductResponse[] {
  return [...products].sort((a, b) => {
    const aOwn = ownBrandId && a.brandId === ownBrandId;
    const bOwn = ownBrandId && b.brandId === ownBrandId;
    if (aOwn !== bOwn) return aOwn ? -1 : 1;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });
}
