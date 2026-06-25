import {
  ArrowRightLeft,
  Banknote,
  CreditCard,
  LucideIconData,
  Smartphone,
  Wallet,
} from 'lucide-angular';

import { CardBrand, PaymentMethod, SaleStatus, SaleType } from './sales.types';

// Single source of truth for how payment methods and card brands are rendered
// across the POS (cart selector + recent-sales list). Spanish UI labels.

export type SaleTagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Cash: 'Efectivo',
  DebitCard: 'Débito',
  CreditCard: 'Crédito',
  Transfer: 'Transferencia',
  MercadoPago: 'Mercado Pago',
};

const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIconData> = {
  Cash: Banknote,
  DebitCard: Wallet,
  CreditCard: CreditCard,
  Transfer: ArrowRightLeft,
  MercadoPago: Smartphone,
};

const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  Visa: 'Visa',
  MasterCard: 'Mastercard',
  Oca: 'OCA',
  Other: 'Otra',
};

const SALE_TYPE_LABELS: Record<SaleType, string> = {
  Sale: 'Venta',
  Return: 'Devolución',
};

const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  Completed: 'Completado',
  Canceled: 'Anulado',
  Pending: 'Pendiente',
  Refunded: 'Reintegrado',
};

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] ?? 'Pago';
}

export function paymentMethodIcon(method: PaymentMethod): LucideIconData {
  return PAYMENT_METHOD_ICONS[method] ?? Banknote;
}

export function cardBrandLabel(brand: CardBrand): string {
  return CARD_BRAND_LABELS[brand] ?? 'Otra';
}

export function saleTypeLabel(type: SaleType): string {
  return SALE_TYPE_LABELS[type] ?? 'Venta';
}

export function saleStatusLabel(status: SaleStatus): string {
  return SALE_STATUS_LABELS[status] ?? 'Estado';
}

export function saleTypeStatusLabel(type: SaleType, status: SaleStatus): string {
  return `${saleTypeLabel(type)} · ${saleStatusLabel(status)}`;
}

export function saleTypeStatusSeverity(type: SaleType, status: SaleStatus): SaleTagSeverity {
  if (status === 'Canceled') return 'danger';
  if (status === 'Pending') return 'warn';
  if (status === 'Refunded') return 'info';
  return type === 'Return' ? 'warn' : 'success';
}
