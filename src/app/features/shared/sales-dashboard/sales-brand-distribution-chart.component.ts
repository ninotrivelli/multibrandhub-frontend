import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';

import { SalesDashboardBrandDistributionResponse } from '../../../core/sales/sales.types';
import { formatCurrencyUYU } from '../inventory/inventory.utils';
import { formatRangeSummary } from './sales-dashboard.utils';

@Component({
  selector: 'app-sales-brand-distribution-chart',
  imports: [ChartModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-brand-distribution-chart.component.html',
})
export class SalesBrandDistributionChartComponent {
  readonly distribution = input.required<SalesDashboardBrandDistributionResponse[]>();
  readonly loading = input(false);
  readonly startDate = input.required<string>();
  readonly endDate = input.required<string>();

  protected readonly rangeLabel = computed(() =>
    formatRangeSummary(this.startDate(), this.endDate()),
  );

  protected readonly totalGross = computed(() =>
    this.distribution().reduce((acc, item) => acc + item.grossSalesAmount, 0),
  );

  protected readonly chartData = computed(() => {
    const palette = [
      cssVar('--p-primary-color', '#14b8a6'),
      cssVar('--p-orange-500', '#f97316'),
      cssVar('--p-cyan-500', '#06b6d4'),
      cssVar('--p-purple-500', '#8b5cf6'),
      cssVar('--p-pink-500', '#ec4899'),
      cssVar('--p-green-500', '#22c55e'),
    ];

    return {
      labels: this.distribution().map((item) => item.brandName),
      datasets: [
        {
          label: 'Ventas brutas',
          data: this.distribution().map((item) => item.grossSalesAmount),
          backgroundColor: this.distribution().map((_, index) => palette[index % palette.length]),
          hoverOffset: 4,
        },
      ],
    };
  });

  protected readonly chartOptions = computed(() => {
    const textColor = cssVar('--p-text-color', '#334155');
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, boxWidth: 12, boxHeight: 12 },
        },
        tooltip: {
          callbacks: {
            label: (context: DoughnutTooltipContext) => {
              const label = context.label ? `${context.label}: ` : '';
              return `${label}${formatCurrencyUYU(extractTooltipNumber(context))}`;
            },
          },
        },
      },
    };
  });

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }
}

interface DoughnutTooltipContext {
  label?: string;
  parsed?: number | { y?: number | null } | null;
  raw?: unknown;
}

function extractTooltipNumber(context: DoughnutTooltipContext): number {
  if (typeof context.parsed === 'number') return context.parsed;
  if (typeof context.parsed?.y === 'number') return context.parsed.y;
  if (typeof context.raw === 'number') return context.raw;
  return 0;
}

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
