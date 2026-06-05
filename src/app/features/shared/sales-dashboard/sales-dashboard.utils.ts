import { formatUruguayDate } from '../inventory/inventory.utils';

export type SalesDashboardVariant = 'admin' | 'brand-manager';

export type SalesDashboardMonthPreset = `month:${string}`;

export type SalesDashboardPeriodPreset = 'currentMonth' | SalesDashboardMonthPreset | 'custom';

export interface SalesDashboardPeriodOption {
  label: string;
  value: SalesDashboardPeriodPreset;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface WeekNavigationBounds {
  minWeekStart: string;
  maxWeekStart: string;
}

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('es-UY', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
});

const MONTH_FORMATTER = new Intl.DateTimeFormat('es-UY', {
  timeZone: 'UTC',
  month: 'long',
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('es-UY', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('es-UY', {
  timeZone: 'UTC',
  weekday: 'short',
});

export function currentMonthRange(today = formatUruguayDate()): DateRange {
  return { startDate: `${today.slice(0, 8)}01`, endDate: today };
}

export function previousMonthRange(today = formatUruguayDate()): DateRange {
  const current = parseDateOnly(today);
  const previousMonth = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1));
  return monthRange(yearMonthValue(previousMonth));
}

export function monthRange(yearMonth: string): DateRange {
  const [year, monthNumber] = yearMonth.split('-').map(Number);
  const month = monthNumber - 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return {
    startDate: formatDateOnly(new Date(Date.UTC(year, month, 1))),
    endDate: formatDateOnly(new Date(Date.UTC(year, month, lastDay))),
  };
}

export function periodRangeForPreset(
  preset: Exclude<SalesDashboardPeriodPreset, 'custom'>,
  today = formatUruguayDate(),
): DateRange {
  return preset === 'currentMonth' ? currentMonthRange(today) : monthRange(preset.slice(6));
}

export function periodOptionsForCurrentYear(today = formatUruguayDate()): SalesDashboardPeriodOption[] {
  const current = parseDateOnly(today);
  const year = current.getUTCFullYear();
  const currentMonth = current.getUTCMonth();
  const options: SalesDashboardPeriodOption[] = [
    {
      label: `Mes actual (${formatMonthName(yearMonthValue(current))})`,
      value: 'currentMonth',
    },
  ];

  for (let month = currentMonth - 1; month >= 0; month -= 1) {
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    options.push({
      label: formatMonthName(yearMonth),
      value: `month:${yearMonth}`,
    });
  }

  options.push({ label: 'Personalizado', value: 'custom' });
  return options;
}

export function normalizeDateRange(startDate: string, endDate: string): DateRange {
  if (compareDateOnly(startDate, endDate) <= 0) return { startDate, endDate };
  return { startDate: endDate, endDate: startDate };
}

export function startOfWeekMonday(dateOnly: string): string {
  const date = parseDateOnly(dateOnly);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(dateOnly, offset);
}

export function defaultWeekStartForRange(
  startDate: string,
  endDate: string,
  today = formatUruguayDate(),
): string {
  const currentWeek = startOfWeekMonday(today);
  const currentWeekEnd = addDays(currentWeek, 6);

  if (rangesIntersect(startDate, endDate, currentWeek, currentWeekEnd)) {
    return clampWeekStart(currentWeek, startDate, endDate, today);
  }

  return clampWeekStart(startOfWeekMonday(endDate), startDate, endDate, today);
}

export function weekNavigationBounds(
  startDate: string,
  endDate: string,
  today = formatUruguayDate(),
): WeekNavigationBounds {
  const currentWeek = startOfWeekMonday(today);
  const currentWeekEnd = addDays(currentWeek, 6);
  const firstRangeWeek = startOfWeekMonday(startDate);
  const lastRangeWeek = startOfWeekMonday(endDate);

  if (rangesIntersect(startDate, endDate, currentWeek, currentWeekEnd)) {
    const fourWeeksBack = addDays(currentWeek, -28);
    return {
      minWeekStart: maxDateOnly(firstRangeWeek, fourWeeksBack),
      maxWeekStart: currentWeek,
    };
  }

  return {
    minWeekStart: firstRangeWeek,
    maxWeekStart: lastRangeWeek,
  };
}

export function clampWeekStart(
  weekStart: string,
  startDate: string,
  endDate: string,
  today = formatUruguayDate(),
): string {
  const bounds = weekNavigationBounds(startDate, endDate, today);
  return minDateOnly(maxDateOnly(weekStart, bounds.minWeekStart), bounds.maxWeekStart);
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function addDays(dateOnly: string, days: number): string {
  const date = parseDateOnly(dateOnly);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

export function compareDateOnly(a: string, b: string): number {
  return a.localeCompare(b);
}

export function dateOnlyInRange(dateOnly: string, startDate: string, endDate: string): boolean {
  return compareDateOnly(dateOnly, startDate) >= 0 && compareDateOnly(dateOnly, endDate) <= 0;
}

export function formatLongDate(dateOnly: string): string {
  return LONG_DATE_FORMATTER.format(parseDateOnly(dateOnly));
}

export function formatMonthName(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const label = MONTH_FORMATTER.format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatShortDateOnly(dateOnly: string): string {
  return SHORT_DATE_FORMATTER.format(parseDateOnly(dateOnly));
}

export function formatWeekday(dateOnly: string): string {
  const label = WEEKDAY_FORMATTER.format(parseDateOnly(dateOnly)).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatRangeSummary(startDate: string, endDate: string): string {
  return `${formatLongDate(startDate)} al ${formatLongDate(endDate)}`;
}

function parseDateOnly(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function yearMonthValue(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function rangesIntersect(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return compareDateOnly(aStart, bEnd) <= 0 && compareDateOnly(bStart, aEnd) <= 0;
}

function maxDateOnly(a: string, b: string): string {
  return compareDateOnly(a, b) >= 0 ? a : b;
}

function minDateOnly(a: string, b: string): string {
  return compareDateOnly(a, b) <= 0 ? a : b;
}
