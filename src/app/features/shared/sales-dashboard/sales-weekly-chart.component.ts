import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { ChevronLeft, ChevronRight, LucideAngularModule } from 'lucide-angular';

import { SalesDashboardDailySalesResponse } from '../../../core/sales/sales.types';
import { formatCurrencyUYU } from '../inventory/inventory.utils';
import {
  dateOnlyInRange,
  formatRangeSummary,
  formatShortDateOnly,
  formatWeekday,
  weekDays,
} from './sales-dashboard.utils';

@Component({
  selector: 'app-sales-weekly-chart',
  imports: [ButtonModule, ChartModule, SkeletonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-weekly-chart.component.html',
})
export class SalesWeeklyChartComponent {
  readonly dailySales = input.required<SalesDashboardDailySalesResponse[]>();
  readonly loading = input(false);
  readonly weekStart = input.required<string>();
  readonly startDate = input.required<string>();
  readonly endDate = input.required<string>();
  readonly canMovePrevious = input(false);
  readonly canMoveNext = input(false);

  readonly previousWeek = output<void>();
  readonly nextWeek = output<void>();

  protected readonly icons = { ChevronLeft, ChevronRight };

  protected readonly rows = computed(() => {
    const byDate = new Map(this.dailySales().map((item) => [item.date, item]));
    return weekDays(this.weekStart()).map((date) => {
      const item = byDate.get(date);
      const inRange = dateOnlyInRange(date, this.startDate(), this.endDate());
      return {
        date,
        label: `${formatWeekday(date)} ${formatShortDateOnly(date)}`,
        grossSalesAmount: inRange ? (item?.grossSalesAmount ?? 0) : 0,
        returnsAmount: inRange ? (item?.returnsAmount ?? 0) : 0,
        netSalesAmount: inRange ? (item?.netSalesAmount ?? 0) : 0,
        inRange,
      };
    });
  });

  protected readonly hasMovement = computed(() =>
    this.rows().some((row) => row.grossSalesAmount !== 0 || row.returnsAmount !== 0),
  );

  protected readonly chartData = computed(() => {
    const primary = cssVar('--p-primary-color', '#14b8a6');
    const primaryMuted = colorWithAlpha(primary, 0.25);
    const red = cssVar('--p-red-500', '#ef4444');
    const redMuted = colorWithAlpha(red, 0.25);

    return {
      labels: this.rows().map((row) => row.label),
      datasets: [
        {
          label: 'Ventas brutas',
          data: this.rows().map((row) => row.grossSalesAmount),
          backgroundColor: this.rows().map((row) => (row.inRange ? primary : primaryMuted)),
          borderColor: primary,
          borderWidth: 1,
          borderRadius: 6,
        },
        {
          label: 'Devoluciones',
          data: this.rows().map((row) => -row.returnsAmount),
          backgroundColor: this.rows().map((row) => (row.inRange ? red : redMuted)),
          borderColor: red,
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };
  });

  protected readonly chartOptions = computed(() => {
    const textColor = cssVar('--p-text-color', '#334155');
    const mutedColor = cssVar('--p-text-muted-color', '#64748b');
    const borderColor = cssVar('--p-content-border-color', '#e2e8f0');

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor, boxWidth: 12, boxHeight: 12 },
        },
        tooltip: {
          callbacks: {
            label: (context: BarTooltipContext) => {
              const label = context.dataset.label ? `${context.dataset.label}: ` : '';
              const value = context.parsed.y ?? 0;
              return `${label}${formatCurrencyUYU(value)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: mutedColor },
          grid: { color: borderColor },
        },
        y: {
          beginAtZero: true,
          ticks: { color: mutedColor },
          grid: { color: borderColor },
        },
      },
    };
  });

  protected readonly weekLabel = computed(() => {
    const days = weekDays(this.weekStart());
    return formatRangeSummary(days[0], days[6]);
  });

  protected netSummary(): string {
    const total = this.rows().reduce((acc, row) => acc + row.netSalesAmount, 0);
    return formatCurrencyUYU(total);
  }
}

interface BarTooltipContext {
  dataset: {
    label?: string;
  };
  parsed: {
    y?: number | null;
  };
}

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  return color;
}
