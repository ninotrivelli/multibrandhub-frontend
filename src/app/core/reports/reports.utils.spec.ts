import { HttpHeaders, HttpResponse } from '@angular/common/http';

import { ReportExportColumnDataType } from './reports.types';
import {
  currentUruguayMonthRange,
  fallbackReportFileName,
  formatReportCell,
  formatSummaryValue,
  normalizeDateRange,
  resolveReportFileName,
} from './reports.utils';

function column(key: string, dataType: ReportExportColumnDataType = 'string') {
  return { key, header: key, dataType };
}

describe('reports utils', () => {
  it('builds and normalizes report date ranges', () => {
    expect(currentUruguayMonthRange('2026-07-27')).toEqual({
      from: '2026-07-01',
      to: '2026-07-27',
    });
    expect(currentUruguayMonthRange().from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(normalizeDateRange('2026-07-01', '2026-07-27')).toEqual({
      from: '2026-07-01',
      to: '2026-07-27',
    });
    expect(normalizeDateRange('2026-07-27', '2026-07-01')).toEqual({
      from: '2026-07-01',
      to: '2026-07-27',
    });
  });

  it('formats empty, boolean, numeric, money, and datetime cells', () => {
    expect(formatReportCell(null, column('value'))).toBe('—');
    expect(formatReportCell(undefined, column('value'))).toBe('—');
    expect(formatReportCell('', column('value'))).toBe('—');

    for (const value of [true, 1, 'true', 'sí', 'si', '1']) {
      expect(formatReportCell(value, column('active', 'boolean'))).toBe('Sí');
    }
    for (const value of [false, 0, 'false', 'no']) {
      expect(formatReportCell(value, column('active', 'boolean'))).toBe('No');
    }

    expect(formatReportCell(1234, column('amount', 'number'))).toContain('1');
    expect(formatReportCell('1234', column('amount', 'number'))).toContain('1');
    expect(formatReportCell('not-a-number', column('amount', 'number'))).toBe('not-a-number');
    expect(formatReportCell(1234, column('amount', 'money'))).toContain('$');
    expect(formatReportCell('not-money', column('amount', 'money'))).toBe('not-money');

    expect(formatReportCell('2026-07-27', column('createdAt', 'datetime'))).toContain('2026');
    expect(formatReportCell('2026-07-27T15:30:00', column('createdAt', 'datetime'))).toContain(
      '2026',
    );
    expect(formatReportCell(new Date(2026, 6, 27, 15, 30), column('createdAt', 'datetime'))).toContain(
      '2026',
    );
    expect(formatReportCell('invalid-date', column('createdAt', 'datetime'))).toBe('invalid-date');
    expect(formatReportCell(42, column('createdAt', 'datetime'))).toBe('42');
  });

  it.each([
    ['paymentMethod', 'Cash', 'Efectivo'],
    ['paymentMethod', 'CreditCard', 'Crédito'],
    ['paymentMethod', 'DebitCard', 'Débito'],
    ['paymentMethod', 'Transfer', 'Transferencia'],
    ['paymentMethod', 'MercadoPago', 'Mercado Pago'],
    ['saleStatus', 'Completed', 'Completada'],
    ['saleStatus', 'Canceled', 'Anulada'],
    ['saleStatus', 'Pending', 'Pendiente'],
    ['saleStatus', 'Refunded', 'Reintegrada'],
    ['saleType', 'Sale', 'Venta'],
    ['saleType', 'Return', 'Devolución'],
    ['type', 'StockIn', 'Ingreso'],
    ['type', 'Sale', 'Venta'],
    ['type', 'Return', 'Devolución'],
    ['type', 'Adjustment', 'Ajuste'],
    ['type', 'Loss', 'Egreso'],
    ['type', 'PriceChange', 'Cambio de precio'],
    ['stockStatus', 'InStock', 'OK'],
    ['stockStatus', 'Critical', 'Crítico'],
    ['stockStatus', 'OutOfStock', 'Agotado'],
    ['contractType', 'CommissionOnly', 'Solo comisión'],
    ['contractType', 'FixedRent', 'Renta fija'],
    ['contractType', 'Hybrid', 'Comisión + renta'],
    ['settlementStatus', 'BrandOwesStore', 'Marca debe al local'],
    ['settlementStatus', 'StoreOwesBrand', 'Local debe a marca'],
    ['settlementStatus', 'BreakEven', 'Saldado'],
    ['status', 'Open', 'Abierta'],
    ['status', 'Closed', 'Cerrada'],
  ])('translates %s=%s as Spanish report text', (key, value, expected) => {
    expect(formatReportCell(value, column(key))).toBe(expected);
  });

  it('preserves unknown report strings and stringifies other values', () => {
    expect(formatReportCell('Unknown', column('paymentMethod'))).toBe('Unknown');
    expect(formatReportCell('Plain text', column('other'))).toBe('Plain text');
    expect(formatReportCell(27, column('other'))).toBe('27');
  });

  it('formats all supported summary value shapes', () => {
    expect(formatSummaryValue(null)).toBe('—');
    expect(formatSummaryValue(undefined)).toBe('—');
    expect(formatSummaryValue('')).toBe('—');
    expect(formatSummaryValue(true)).toBe('Sí');
    expect(formatSummaryValue(false)).toBe('No');
    expect(formatSummaryValue(1234)).toContain('1');
    expect(formatSummaryValue('Resumen')).toBe('Resumen');
    expect(formatSummaryValue({ value: 1 })).toBe('[object Object]');
  });

  it('builds fallback names and resolves standard and UTF-8 response filenames', () => {
    const fallback = fallbackReportFileName('SalesDetail', '2026-07-01', '2026-07-27');
    expect(fallback).toBe('SalesDetail-20260701-20260727.xlsx');

    expect(resolveReportFileName(new HttpResponse<Blob>(), fallback)).toBe(fallback);
    expect(
      resolveReportFileName(
        new HttpResponse<Blob>({
          headers: new HttpHeaders({
            'content-disposition': `attachment; filename*=UTF-8''ventas%20julio.xlsx`,
          }),
        }),
        fallback,
      ),
    ).toBe('ventas julio.xlsx');
    expect(
      resolveReportFileName(
        new HttpResponse<Blob>({
          headers: new HttpHeaders({
            'content-disposition': 'attachment; filename="ventas-julio.xlsx"',
          }),
        }),
        fallback,
      ),
    ).toBe('ventas-julio.xlsx');
    expect(
      resolveReportFileName(
        new HttpResponse<Blob>({
          headers: new HttpHeaders({ 'content-disposition': 'attachment' }),
        }),
        fallback,
      ),
    ).toBe(fallback);
  });
});
