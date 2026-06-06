import { brandChipColors, brandHeaderStyle } from './brand-colors';
import { movementTypeSeverity } from '../../features/shared/inventory/inventory.utils';
import { MovementType } from '../../features/shared/inventory/inventory.types';

describe('brand colors', () => {
  it('returns the same colors for the same brand id', () => {
    const first = brandChipColors({ brandId: 'brand-zendra', brandName: 'Zendra' });
    const second = brandChipColors({ brandId: 'brand-zendra', brandName: 'Renamed Zendra' });

    expect(second).toEqual(first);
  });

  it('returns different colors for different sample brand ids', () => {
    const colors = [
      brandChipColors({ brandId: 'brand-zendra' }),
      brandChipColors({ brandId: 'brand-lumina' }),
      brandChipColors({ brandId: 'brand-bohemia' }),
      brandChipColors({ brandId: 'brand-kora' }),
    ].map((c) => `${c.background}|${c.text}|${c.border}`);

    expect(new Set(colors).size).toBe(colors.length);
  });

  it('uses a stable normalized brand name fallback when the id is missing', () => {
    const first = brandChipColors({ brandName: '  Básicos   del Sur ' });
    const second = brandChipColors({ brandName: 'basicos del sur' });

    expect(second).toEqual(first);
  });

  it('does not use PrimeNG severity names or movement severity mappings as colors', () => {
    const colors = Object.values(brandChipColors({ brandId: 'brand-zendra' }));
    const reserved = new Set([
      'info',
      'warn',
      'success',
      'danger',
      'secondary',
      'contrast',
      movementTypeSeverity(MovementType.StockIn),
      movementTypeSeverity(MovementType.Sale),
      movementTypeSeverity(MovementType.Return),
      movementTypeSeverity(MovementType.Adjustment),
      movementTypeSeverity(MovementType.Loss),
      movementTypeSeverity(MovementType.PriceChange),
    ]);

    expect(colors.some((color) => reserved.has(color))).toBe(false);
  });

  it('builds a header style from the assigned brand colors', () => {
    const colors = brandChipColors({ brandId: 'brand-zendra' });

    expect(brandHeaderStyle({ brandId: 'brand-zendra' })).toEqual({
      'background-color': colors.headerBackground,
      color: colors.text,
      'border-color': colors.border,
    });
  });
});
