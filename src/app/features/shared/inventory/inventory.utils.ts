import { MovementType, ProductResponse, StockStatusLabel } from './inventory.types';

export const URUGUAY_TIME_ZONE = 'America/Montevideo';

// Map the seed category names to the matching placeholder PNG under
// `public/images/placeholders/categories/`. Backend always seeds these
// 22 names, so the lookup is safe to hardcode. Casing matches the actual
// files on disk (note `Swimwear.png` and the accented `pañuelos.png`).
const CATEGORY_PLACEHOLDER_BY_NAME: Record<string, string> = {
  Anillos: 'anillos.png',
  'Aros y caravanas': 'aros-y-caravanas.png',
  Pulseras: 'pulseras.png',
  'Collares y gargantillas': 'collares-y-gargantillas.png',
  'Piedras Naturales': 'piedras-naturales.png',
  Gorros: 'gorros.png',
  Pañuelos: 'pañuelos.png',
  Cinturones: 'cinturones.png',
  Otros: 'otros.png',
  Bolsos: 'bolsos.png',
  Lentes: 'lentes.png',
  Shorts: 'shorts.png',
  Camisas: 'camisas.png',
  Remeras: 'remeras.png',
  Swimwear: 'Swimwear.png',
  Blusas: 'blusas.png',
  Tops: 'tops.png',
  Sweaters: 'sweaters.png',
  Sacos: 'sacos.png',
  Vestidos: 'vestidos.png',
  Faldas: 'faldas.png',
  Pantalones: 'pantalones.png',
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
  [MovementType.Loss]: 'Egreso',
  [MovementType.PriceChange]: 'Cambio de precio',
};

export function movementTypeLabel(type: MovementType): string {
  return MOVEMENT_LABELS[type] ?? 'Movimiento';
}

const MOVEMENT_SEVERITY: Record<
  MovementType,
  'success' | 'danger' | 'info' | 'warn' | 'secondary'
> = {
  [MovementType.StockIn]: 'success',
  [MovementType.Sale]: 'info',
  // Orange to match the "Devolución" tag in the POS recent-sales list.
  [MovementType.Return]: 'warn',
  [MovementType.Adjustment]: 'warn',
  [MovementType.Loss]: 'danger',
  [MovementType.PriceChange]: 'secondary',
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

export function parseBackendUtcDate(iso: string): Date {
  const value = iso.trim();
  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

export function formatUruguayDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: URUGUAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function formatMovementDate(iso: string): string {
  const date = parseBackendUtcDate(iso);
  return new Intl.DateTimeFormat('es-UY', {
    timeZone: URUGUAY_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Full numeric date in Uruguay time: "dd/MM/yyyy".
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('es-UY', {
    timeZone: URUGUAY_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseBackendUtcDate(iso));
}

// Relative day marker in Uruguay time: "Hoy" / "Ayer" / null. Rendered as a
// small parenthetical next to the full date so the column always shows the date.
export function relativeDayLabel(iso: string): 'Hoy' | 'Ayer' | null {
  const target = formatUruguayDate(parseBackendUtcDate(iso));
  if (target === formatUruguayDate()) return 'Hoy';

  const yesterday = formatUruguayDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (target === yesterday) return 'Ayer';

  return null;
}

export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export interface BuildSkuCandidateInput {
  brandCode: string;
  productName: string;
  size?: string | null;
  color?: string | null;
  attempt: number;
}

const SKU_STOP_WORDS = new Set([
  'Y',
  'DE',
  'DEL',
  'LA',
  'EL',
  'LOS',
  'LAS',
  'UN',
  'UNA',
  'EN',
  'CON',
  'PARA',
  'POR',
]);

export function buildSkuCandidate(input: BuildSkuCandidateInput): string {
  const brandPart = buildSkuSegment(input.brandCode, 4, 'GEN');
  const namePart = buildSkuSegment(input.productName, 6, 'GEN');
  const sizePart = buildOptionalSkuSegment(input.size, 6);
  const colorPart = buildOptionalSkuSegment(input.color, 6);
  const numPart = String(input.attempt).padStart(3, '0');

  return [brandPart, namePart, sizePart, colorPart, numPart]
    .filter((part): part is string => !!part)
    .join('-');
}

function buildOptionalSkuSegment(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  const segment = buildSkuSegment(value ?? '', maxLength, '');
  return segment.length > 0 ? segment : null;
}

function buildSkuSegment(value: string, maxLength: number, fallback: string): string {
  const words = stripAccents(value)
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .filter((word) => !SKU_STOP_WORDS.has(word));

  if (words.length === 0) return fallback.slice(0, maxLength);
  if (words.length === 1) return words[0].slice(0, maxLength);

  const selectedWords = words.slice(0, Math.min(words.length, maxLength <= 4 ? 2 : 3));
  const charsPerWord = Math.max(1, Math.floor(maxLength / selectedWords.length));

  return selectedWords
    .map((word) => word.slice(0, charsPerWord))
    .join('')
    .slice(0, maxLength);
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
