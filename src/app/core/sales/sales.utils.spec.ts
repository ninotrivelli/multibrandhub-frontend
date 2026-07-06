import {
  saleStatusLabel,
  saleTypeLabel,
  saleTypeStatusLabel,
  saleTypeStatusSeverity,
} from './sales.utils';

describe('sales utils', () => {
  it('renders Spanish labels for sale types and statuses', () => {
    expect(saleTypeLabel('Sale')).toBe('Venta');
    expect(saleTypeLabel('Return')).toBe('Devolución');
    expect(saleStatusLabel('Completed')).toBe('Completado');
    expect(saleStatusLabel('Canceled')).toBe('Anulado');
    expect(saleStatusLabel('Pending')).toBe('Pendiente');
    expect(saleStatusLabel('Refunded')).toBe('Reintegrado');
  });

  it('combines sale type and status labels', () => {
    expect(saleTypeStatusLabel('Sale', 'Completed')).toBe('Venta · Completado');
    expect(saleTypeStatusLabel('Sale', 'Canceled')).toBe('Venta · Anulado');
    expect(saleTypeStatusLabel('Return', 'Completed')).toBe('Devolución · Completado');
  });

  it('maps sale status to display severity', () => {
    expect(saleTypeStatusSeverity('Sale', 'Completed')).toBe('success');
    expect(saleTypeStatusSeverity('Return', 'Completed')).toBe('warn');
    expect(saleTypeStatusSeverity('Sale', 'Canceled')).toBe('danger');
    expect(saleTypeStatusSeverity('Sale', 'Pending')).toBe('warn');
    expect(saleTypeStatusSeverity('Sale', 'Refunded')).toBe('info');
  });
});
