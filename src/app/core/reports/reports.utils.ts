import { HttpResponse } from '@angular/common/http';

import { ReportExportColumnResponse, ReportExportType } from './reports.types';

const MONEY_FORMATTER = new Intl.NumberFormat('es-UY', {
  style: 'currency',
  currency: 'UYU',
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('es-UY');

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('es-UY', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface DateRange {
  from: string;
  to: string;
}

export function currentUruguayMonthRange(today = uruguayDateOnly()): DateRange {
  return {
    from: `${today.slice(0, 8)}01`,
    to: today,
  };
}

export function normalizeDateRange(from: string, to: string): DateRange {
  if (from <= to) return { from, to };
  return { from: to, to: from };
}

export function formatReportCell(value: unknown, column: ReportExportColumnResponse): string {
  if (value === null || value === undefined || value === '') return '—';

  if (column.dataType === 'boolean') return booleanValue(value) ? 'Sí' : 'No';
  if (column.dataType === 'money') return formatNumberLike(value, MONEY_FORMATTER);
  if (column.dataType === 'number') return formatNumberLike(value, NUMBER_FORMATTER);
  if (column.dataType === 'datetime') return formatDateTime(value);

  if (typeof value === 'string') return translateReportValue(column.key, value);
  return String(value);
}

export function formatSummaryValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return NUMBER_FORMATTER.format(value);
  if (typeof value === 'string') return value;
  return String(value);
}

export function fallbackReportFileName(
  reportType: ReportExportType,
  from: string,
  to: string,
): string {
  return `${reportType}-${from.replaceAll('-', '')}-${to.replaceAll('-', '')}.xlsx`;
}

export function resolveReportFileName(
  response: HttpResponse<Blob>,
  fallbackFileName: string,
): string {
  const header = response.headers.get('content-disposition');
  if (!header) return fallbackFileName;

  const fileNameStar = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (fileNameStar) return decodeURIComponent(fileNameStar.replaceAll('"', '').trim());

  const fileName = /filename="?([^";]+)"?/i.exec(header)?.[1];
  return fileName?.trim() || fallbackFileName;
}

function uruguayDateOnly(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Montevideo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

function formatNumberLike(value: unknown, formatter: Intl.NumberFormat): string {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? formatter.format(parsed) : String(value);
}

function formatDateTime(value: unknown): string {
  if (value instanceof Date) return DATE_TIME_FORMATTER.format(value);
  if (typeof value !== 'string') return String(value);

  const candidate = DATE_ONLY_REGEX.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? value : DATE_TIME_FORMATTER.format(date);
}

function booleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return ['true', 'sí', 'si', '1'].includes(String(value).trim().toLowerCase());
}

function translateReportValue(key: string, value: string): string {
  if (key === 'paymentMethod') return PAYMENT_METHOD_LABELS[value] ?? value;
  if (key === 'saleStatus') return SALE_STATUS_LABELS[value] ?? value;
  if (key === 'saleType') return SALE_TYPE_LABELS[value] ?? value;
  if (key === 'type') return MOVEMENT_TYPE_LABELS[value] ?? value;
  if (key === 'stockStatus') return STOCK_STATUS_LABELS[value] ?? value;
  if (key === 'contractType') return CONTRACT_TYPE_LABELS[value] ?? value;
  if (key === 'settlementStatus') return SETTLEMENT_STATUS_LABELS[value] ?? value;
  if (key === 'status') return CASH_REGISTER_STATUS_LABELS[value] ?? value;
  return value;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  Cash: 'Efectivo',
  CreditCard: 'Crédito',
  DebitCard: 'Débito',
  Transfer: 'Transferencia',
  MercadoPago: 'Mercado Pago',
};

const SALE_STATUS_LABELS: Record<string, string> = {
  Completed: 'Completada',
  Canceled: 'Anulada',
  Pending: 'Pendiente',
  Refunded: 'Reintegrada',
};

const SALE_TYPE_LABELS: Record<string, string> = {
  Sale: 'Venta',
  Return: 'Devolución',
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  StockIn: 'Ingreso',
  Sale: 'Venta',
  Return: 'Devolución',
  Adjustment: 'Ajuste',
  Loss: 'Egreso',
  PriceChange: 'Cambio de precio',
};

const STOCK_STATUS_LABELS: Record<string, string> = {
  InStock: 'OK',
  Critical: 'Crítico',
  OutOfStock: 'Agotado',
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CommissionOnly: 'Solo comisión',
  FixedRent: 'Renta fija',
  Hybrid: 'Comisión + renta',
};

const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  BrandOwesStore: 'Marca debe al local',
  StoreOwesBrand: 'Local debe a marca',
  BreakEven: 'Saldado',
};

const CASH_REGISTER_STATUS_LABELS: Record<string, string> = {
  Open: 'Abierta',
  Closed: 'Cerrada',
};
