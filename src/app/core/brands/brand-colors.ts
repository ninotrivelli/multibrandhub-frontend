export interface BrandColorInput {
  brandId?: string | null;
  brandName?: string | null;
}

export interface BrandChipColors {
  background: string;
  text: string;
  border: string;
  headerBackground: string;
}

export type BrandStyle = Record<string, string>;

// Brand colors intentionally live outside PrimeNG severities (info/warn/etc.)
// and the app's sale/movement chips. The hue space below stays in cyan,
// violet, and magenta ranges so brand identity never borrows operational colors.
const BRAND_HUE_RANGES: readonly [start: number, end: number][] = [
  [168, 196],
  [248, 336],
];

export function brandChipColors(input: BrandColorInput): BrandChipColors {
  const hash = hashString(brandColorKey(input));
  const hue = pickBrandHue(hash);
  const saturation = 56 + (hash % 13);
  const textLightness = 24 + ((hash >>> 8) % 8);
  const backgroundLightness = 92 + ((hash >>> 16) % 3);
  const headerLightness = 89 + ((hash >>> 20) % 3);

  return {
    background: `hsl(${hue} ${saturation}% ${backgroundLightness}%)`,
    text: `hsl(${hue} ${saturation}% ${textLightness}%)`,
    border: `hsl(${hue} ${saturation}% 76%)`,
    headerBackground: `hsl(${hue} ${saturation}% ${headerLightness}%)`,
  };
}

export function brandHeaderStyle(input: BrandColorInput): BrandStyle {
  const colors = brandChipColors(input);
  return {
    'background-color': colors.headerBackground,
    color: colors.text,
    'border-color': colors.border,
  };
}

function brandColorKey(input: BrandColorInput): string {
  const id = input.brandId?.trim();
  if (id) return `id:${id.toLowerCase()}`;

  const name = normalizeBrandName(input.brandName);
  return name ? `name:${name}` : 'brand:unknown';
}

function normalizeBrandName(name: string | null | undefined): string {
  return (name ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickBrandHue(hash: number): number {
  const totalWidth = BRAND_HUE_RANGES.reduce((sum, [start, end]) => sum + end - start + 1, 0);
  let offset = hash % totalWidth;

  for (const [start, end] of BRAND_HUE_RANGES) {
    const width = end - start + 1;
    if (offset < width) return start + offset;
    offset -= width;
  }

  return BRAND_HUE_RANGES[0][0];
}
