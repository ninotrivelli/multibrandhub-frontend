import {
  ArrowRightLeft,
  Banknote,
  CreditCard,
  LucideIconData,
  Smartphone,
  Wallet,
} from 'lucide-angular';

import { CardBrand, PaymentMethod } from './sales.types';

// Single source of truth for how payment methods and card brands are rendered
// across the POS (cart selector + recent-sales list). Spanish UI labels.

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

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] ?? 'Pago';
}

export function paymentMethodIcon(method: PaymentMethod): LucideIconData {
  return PAYMENT_METHOD_ICONS[method] ?? Banknote;
}

export function cardBrandLabel(brand: CardBrand): string {
  return CARD_BRAND_LABELS[brand] ?? 'Otra';
}
