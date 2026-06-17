import {
  ArrowRightLeft,
  Banknote,
  CreditCard,
  LucideIconData,
  Smartphone,
} from 'lucide-angular';

import { PaymentMethod } from '../sales/sales.types';
import {
  CashRegisterPaymentTotalResponse,
  CashRegisterReconciliationLineResponse,
} from './cash-register.types';

// POS terminals report credit and debit card sales as a single figure, so the
// cash register UI collapses both into one "Tarjeta" line. This is a display
// grouping only — the backend keeps every payment method separate (and the
// close/reconciliation flow still reports amounts per individual method).
export type CashPaymentGroup = 'Cash' | 'Card' | 'Transfer' | 'MercadoPago';

export const CASH_PAYMENT_GROUPS: readonly CashPaymentGroup[] = [
  'Cash',
  'Card',
  'Transfer',
  'MercadoPago',
];

const GROUP_LABELS: Record<CashPaymentGroup, string> = {
  Cash: 'Efectivo',
  Card: 'Tarjeta (Crédito + Débito)',
  Transfer: 'Transferencia',
  MercadoPago: 'Mercado Pago',
};

const GROUP_ICONS: Record<CashPaymentGroup, LucideIconData> = {
  Cash: Banknote,
  Card: CreditCard,
  Transfer: ArrowRightLeft,
  MercadoPago: Smartphone,
};

export function paymentGroupOf(method: PaymentMethod): CashPaymentGroup {
  return method === 'CreditCard' || method === 'DebitCard' ? 'Card' : method;
}

export function paymentGroupLabel(group: CashPaymentGroup): string {
  return GROUP_LABELS[group];
}

export function paymentGroupIcon(group: CashPaymentGroup): LucideIconData {
  return GROUP_ICONS[group];
}

export interface GroupedPaymentTotal {
  group: CashPaymentGroup;
  grossSalesAmount: number;
  returnsAmount: number;
  netAmount: number;
  reportedAmount: number | null;
  varianceAmount: number | null;
}

export interface GroupedReconciliationLine {
  key: string;
  brandId: string;
  brandName: string;
  group: CashPaymentGroup;
  systemGrossSalesAmount: number;
  systemReturnsAmount: number;
  systemNetAmount: number;
  saleCount: number;
  returnCount: number;
  unitsSold: number;
  unitsReturned: number;
  netUnits: number;
  reportedAmount: number | null;
  varianceAmount: number | null;
}

export function groupPaymentTotals(
  totals: readonly CashRegisterPaymentTotalResponse[],
): GroupedPaymentTotal[] {
  const byGroup = new Map<CashPaymentGroup, GroupedPaymentTotal>();

  for (const total of totals) {
    const group = paymentGroupOf(total.paymentMethod);
    const acc =
      byGroup.get(group) ??
      ({
        group,
        grossSalesAmount: 0,
        returnsAmount: 0,
        netAmount: 0,
        reportedAmount: null,
        varianceAmount: null,
      } satisfies GroupedPaymentTotal);

    acc.grossSalesAmount += total.grossSalesAmount;
    acc.returnsAmount += total.returnsAmount;
    acc.netAmount += total.netAmount;
    acc.reportedAmount = addNullable(acc.reportedAmount, total.reportedAmount);
    acc.varianceAmount = addNullable(acc.varianceAmount, total.varianceAmount);
    byGroup.set(group, acc);
  }

  return CASH_PAYMENT_GROUPS.filter((group) => byGroup.has(group)).map(
    (group) => byGroup.get(group)!,
  );
}

export function groupReconciliationLines(
  lines: readonly CashRegisterReconciliationLineResponse[],
): GroupedReconciliationLine[] {
  const byKey = new Map<string, GroupedReconciliationLine>();
  const order: string[] = [];

  for (const line of lines) {
    const group = paymentGroupOf(line.paymentMethod);
    const key = `${line.brandId}::${group}`;
    let acc = byKey.get(key);

    if (!acc) {
      acc = {
        key,
        brandId: line.brandId,
        brandName: line.brandName,
        group,
        systemGrossSalesAmount: 0,
        systemReturnsAmount: 0,
        systemNetAmount: 0,
        saleCount: 0,
        returnCount: 0,
        unitsSold: 0,
        unitsReturned: 0,
        netUnits: 0,
        reportedAmount: null,
        varianceAmount: null,
      };
      byKey.set(key, acc);
      order.push(key);
    }

    acc.systemGrossSalesAmount += line.systemGrossSalesAmount;
    acc.systemReturnsAmount += line.systemReturnsAmount;
    acc.systemNetAmount += line.systemNetAmount;
    acc.saleCount += line.saleCount;
    acc.returnCount += line.returnCount;
    acc.unitsSold += line.unitsSold;
    acc.unitsReturned += line.unitsReturned;
    acc.netUnits += line.netUnits;
    acc.reportedAmount = addNullable(acc.reportedAmount, line.reportedAmount);
    acc.varianceAmount = addNullable(acc.varianceAmount, line.varianceAmount);
  }

  return order.map((key) => byKey.get(key)!);
}

export function groupReconciliationLinesForBrand(
  lines: readonly CashRegisterReconciliationLineResponse[],
  brandId: string,
): GroupedReconciliationLine[] {
  return groupReconciliationLines(lines.filter((line) => line.brandId === brandId));
}

// Sums nullable contributions, staying null only when every value is null
// (i.e. an open session that has no reported/variance amounts yet).
function addNullable(acc: number | null, value: number | null | undefined): number | null {
  if (value == null) return acc;
  return (acc ?? 0) + value;
}
