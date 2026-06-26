import {
  SettlementFinancialStatus,
  SettlementOperationalStatus,
} from '../../../core/settlements/settlements.types';
import { formatUruguayDate } from '../inventory/inventory.utils';
import { DateRange, formatMonthName, monthRange } from '../sales-dashboard/sales-dashboard.utils';

export type SettlementPeriodPreset = 'currentMonth' | `month:${string}` | 'custom';

export interface SettlementPeriodOption {
  label: string;
  value: SettlementPeriodPreset;
}

export const OPERATIONAL_STATUS_OPTIONS: Array<{
  label: string;
  value: SettlementOperationalStatus;
}> = [
  { label: 'Borrador', value: 'Draft' },
  { label: 'Finalizada', value: 'Finalized' },
  { label: 'Pagada', value: 'Paid' },
];

export function currentFullMonthRange(today = formatUruguayDate()): DateRange {
  return monthRange(today.slice(0, 7));
}

export function settlementPeriodRangeForPreset(
  preset: Exclude<SettlementPeriodPreset, 'custom'>,
  today = formatUruguayDate(),
): DateRange {
  return preset === 'currentMonth' ? currentFullMonthRange(today) : monthRange(preset.slice(6));
}

export function settlementPeriodOptionsForCurrentYear(
  today = formatUruguayDate(),
): SettlementPeriodOption[] {
  const [year, currentMonth] = today.slice(0, 7).split('-').map(Number);
  const options: SettlementPeriodOption[] = [
    {
      label: `Mes actual (${formatMonthName(today.slice(0, 7))})`,
      value: 'currentMonth',
    },
  ];

  for (let month = currentMonth - 1; month >= 1; month -= 1) {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    options.push({ label: formatMonthName(yearMonth), value: `month:${yearMonth}` });
  }

  options.push({ label: 'Personalizado', value: 'custom' });
  return options;
}

export function settlementOperationalStatusLabel(status: SettlementOperationalStatus): string {
  return OPERATIONAL_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function settlementOperationalStatusSeverity(
  status: SettlementOperationalStatus,
): 'success' | 'info' | 'warn' | 'secondary' {
  switch (status) {
    case 'Draft':
      return 'warn';
    case 'Finalized':
      return 'info';
    case 'Paid':
      return 'success';
  }
}

export function settlementDirectionLabel(status: SettlementFinancialStatus): string {
  switch (status) {
    case 'BrandOwesStore':
      return 'La marca debe pagar al local';
    case 'StoreOwesBrand':
      return 'El local debe transferir a la marca';
    case 'BreakEven':
      return 'Liquidación saldada';
  }
}

export function settlementDirectionSeverity(
  status: SettlementFinancialStatus,
): 'success' | 'info' | 'warn' | 'secondary' {
  switch (status) {
    case 'BrandOwesStore':
      return 'warn';
    case 'StoreOwesBrand':
      return 'info';
    case 'BreakEven':
      return 'success';
  }
}

export function settlementDirectionAmountClasses(status: SettlementFinancialStatus): string {
  const base = 'font-semibold whitespace-nowrap';
  switch (status) {
    case 'BrandOwesStore':
      return `${base} text-amber-700 dark:text-amber-300`;
    case 'StoreOwesBrand':
      return `${base} text-blue-700 dark:text-blue-300`;
    case 'BreakEven':
      return `${base} text-surface-700 dark:text-surface-200`;
  }
}

export function dateOnly(value: string): string {
  return value.slice(0, 10);
}
