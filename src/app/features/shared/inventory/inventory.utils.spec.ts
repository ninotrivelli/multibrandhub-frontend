import { makeProduct } from '../../../../testing/builders';
import { MovementType } from './inventory.types';
import {
  buildSkuCandidate,
  categoryPlaceholderUrl,
  computeStockStatus,
  formatCurrencyUYU,
  formatMovementDate,
  formatNumber,
  formatUruguayDate,
  movementTypeLabel,
  movementTypeSeverity,
  resolveProductImageUrl,
  sortProductsForUser,
} from './inventory.utils';

describe('inventory utils', () => {
  describe('buildSkuCandidate', () => {
    it('generates a segmented SKU from brand and product name', () => {
      expect(
        buildSkuCandidate({
          brandCode: 'Zendra',
          productName: 'Buzo Oversize',
          attempt: 1,
        }),
      ).toBe('ZEND-BUZOVE-001');
    });

    it('includes size and color only when they are present', () => {
      expect(
        buildSkuCandidate({
          brandCode: 'Zendra',
          productName: 'Buzo Oversize',
          size: 'M',
          color: 'Negro',
          attempt: 1,
        }),
      ).toBe('ZEND-BUZOVE-M-NEGRO-001');
    });

    it('normalizes accents, spaces, and unsupported symbols safely', () => {
      expect(
        buildSkuCandidate({
          brandCode: 'Ñan_dú',
          productName: 'Remera con brillo!',
          size: 'Único',
          color: 'Rojo / azul',
          attempt: 2,
        }),
      ).toBe('NADU-REMBRI-UNICO-ROJAZU-002');
    });

    it('pads attempt numbers with three digits', () => {
      expect(
        buildSkuCandidate({
          brandCode: 'Zen',
          productName: 'Top',
          attempt: 12,
        }),
      ).toBe('ZEN-TOP-012');
    });

    it('keeps generated SKUs within backend format constraints', () => {
      const sku = buildSkuCandidate({
        brandCode: 'Marca Larguisima',
        productName: 'Producto con muchisimas palabras descriptivas',
        size: 'Talle extra grande largo',
        color: 'Color con nombre muy largo',
        attempt: 50,
      });

      expect(sku.length).toBeLessThanOrEqual(50);
      expect(sku).toMatch(/^[A-Z0-9\-_]+$/);
      expect(sku.endsWith('-050')).toBe(true);
    });
  });

  describe('stock status and product display helpers', () => {
    it('computes stock status from the per-product threshold', () => {
      expect(computeStockStatus(8, 2)).toBe('OK');
      expect(computeStockStatus(2, 2)).toBe('Crítico');
      expect(computeStockStatus(0, 2)).toBe('Agotado');
    });

    it('falls back to category placeholders when products have no image', () => {
      expect(categoryPlaceholderUrl('Tops')).toBe('/images/placeholders/categories/tops.png');
      expect(categoryPlaceholderUrl('Categoria inexistente')).toBe(
        '/images/placeholders/categories/otros.png',
      );
      expect(resolveProductImageUrl({ imageUrl: ' https://cdn.test/a.png ', categoryName: 'Tops' }))
        .toBe(' https://cdn.test/a.png ');
      expect(resolveProductImageUrl({ imageUrl: null, categoryName: 'Tops' })).toBe(
        '/images/placeholders/categories/tops.png',
      );
    });

    it('sorts the current user brand first and then alphabetically', () => {
      const sorted = sortProductsForUser(
        [
          makeProduct({ id: 'b', name: 'Zapato', brandId: 'brand-b' }),
          makeProduct({ id: 'own', name: 'Abrigo', brandId: 'brand-own' }),
          makeProduct({ id: 'a', name: 'Blusa', brandId: 'brand-a' }),
        ],
        'brand-own',
      );

      expect(sorted.map((product) => product.id)).toEqual(['own', 'a', 'b']);
    });
  });

  describe('movement and formatting helpers', () => {
    it('labels movement types in Spanish and maps severities', () => {
      expect(movementTypeLabel(MovementType.StockIn)).toBe('Ingreso');
      expect(movementTypeLabel(MovementType.Loss)).toBe('Egreso');
      expect(movementTypeSeverity(MovementType.Loss)).toBe('danger');
      expect(movementTypeSeverity(MovementType.Adjustment)).toBe('warn');
    });

    it('formats dates and numbers for Uruguay users', () => {
      const utcDate = new Date('2026-05-24T02:30:00Z');

      expect(formatUruguayDate(utcDate)).toBe('2026-05-23');
      expect(formatMovementDate('2026-05-24T02:30:00')).toContain('23/05/2026');
      expect(formatNumber(1234)).toBe('1.234');
      expect(formatCurrencyUYU(1234)).toContain('1.234');
    });
  });
});
