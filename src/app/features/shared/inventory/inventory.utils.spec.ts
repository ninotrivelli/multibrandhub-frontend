import { buildSkuCandidate } from './inventory.utils';

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
});
