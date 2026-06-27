import {
  SettlementFinancialStatus,
  SettlementOperationalStatus,
} from '../../../core/settlements/settlements.types';
import { formatUruguayDate, parseBackendUtcDate } from '../inventory/inventory.utils';
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

/**
 * Human-readable "time ago" in Spanish, limited to days, hours and minutes.
 * Examples: "hace 3 días", "hace 2 h 5 min", "hace 4 minutos", "recién".
 */
export function formatRelativeTimeAgo(value: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - parseBackendUtcDate(value).getTime();
  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 1) return 'recién';

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days >= 1) return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  if (hours >= 1) return minutes > 0 ? `hace ${hours} h ${minutes} min` : `hace ${hours} h`;
  return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}

/**
 * Returns the local date-time as a `YYYY-MM-DDTHH:mm` string suitable for an
 * `input[type=datetime-local]` value. Uses local getters (not UTC) so the input
 * shows the user's wall-clock time.
 */
export function currentLocalDateTimeInput(now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
