import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
  AlertTriangle,
  ArrowRightLeft,
  LucideAngularModule,
  Package,
  Tags,
  Wallet,
} from 'lucide-angular';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';

import { formatCurrencyUYU, formatNumber } from '../inventory.utils';
import { ProductsService } from '../products.service';
import { StockMovementsService } from '../stock-movements.service';

type Variant = 'store' | 'brand';

@Component({
  selector: 'app-inventory-kpis',
  imports: [LucideAngularModule, SkeletonModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'store') {
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <!-- Total en Local -->
        <div
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5 flex items-center gap-4"
        >
          <div
            class="size-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary shrink-0"
          >
            <i-lucide [img]="icons.Package" class="size-6" />
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <span class="text-sm text-surface-500 dark:text-surface-400">Total en Local</span>
            @if (allItemsLoading()) {
              <p-skeleton width="6rem" height="1.75rem" />
            } @else {
              <span class="text-2xl font-bold text-surface-900 dark:text-surface-0 leading-tight">
                {{ totalUnits() }}
                <span class="text-sm font-normal text-surface-500 dark:text-surface-400">
                  unids.
                </span>
              </span>
            }
          </div>
        </div>

        <!-- Movimientos de Hoy -->
        <div
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5 flex items-center gap-4"
          [pTooltip]="todayMovementsTooltip()"
          tooltipPosition="bottom"
        >
          <div
            class="size-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-300 shrink-0"
          >
            <i-lucide [img]="icons.ArrowRightLeft" class="size-6" />
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <span class="text-sm text-surface-500 dark:text-surface-400">Movimientos de Hoy</span>
            @if (todaySummaryLoading()) {
              <p-skeleton width="7rem" height="1.75rem" />
            } @else {
              <div class="flex items-baseline gap-2 flex-wrap">
                <span
                  class="text-2xl font-bold text-emerald-600 dark:text-emerald-300 leading-tight"
                >
                  +{{ todayInboundUnits() }}
                </span>
                <span class="text-sm text-surface-400 dark:text-surface-500">/</span>
                <span class="text-2xl font-bold text-red-600 dark:text-red-300 leading-tight">
                  -{{ todayOutboundUnits() }}
                </span>
              </div>
              <span class="text-xs text-surface-500 dark:text-surface-400">
                {{ todayMovementsCountLabel() }}
              </span>
            }
          </div>
        </div>

        <!-- Alertas Activas -->
        <div
          class="bg-surface-0 dark:bg-surface-800 border-2 rounded-xl p-5 flex items-center gap-4"
          [class.border-red-200]="alertsCount() > 0"
          [class.dark:border-red-900]="alertsCount() > 0"
          [class.border-surface-200]="alertsCount() === 0"
          [class.dark:border-surface-700]="alertsCount() === 0"
        >
          <div
            class="size-12 rounded-xl flex items-center justify-center shrink-0"
            [class.bg-red-100]="alertsCount() > 0"
            [class.dark:bg-red-900]="alertsCount() > 0"
            [class.text-red-600]="alertsCount() > 0"
            [class.dark:text-red-300]="alertsCount() > 0"
            [class.bg-surface-100]="alertsCount() === 0"
            [class.dark:bg-surface-700]="alertsCount() === 0"
            [class.text-surface-500]="alertsCount() === 0"
          >
            <i-lucide [img]="icons.AlertTriangle" class="size-6" />
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <span class="text-sm text-surface-500 dark:text-surface-400">Alertas Activas</span>
            @if (kpiLoading()) {
              <p-skeleton width="6rem" height="1.75rem" />
            } @else {
              <div class="flex items-baseline gap-2 flex-wrap">
                <span
                  class="text-2xl font-bold leading-tight"
                  [class.text-red-600]="alertsCount() > 0"
                  [class.dark:text-red-300]="alertsCount() > 0"
                  [class.text-surface-900]="alertsCount() === 0"
                  [class.dark:text-surface-0]="alertsCount() === 0"
                >
                  {{ alertsCount() }}
                </span>
                <span class="text-xs text-surface-500 dark:text-surface-400">
                  {{ criticalCount() }} críticos · {{ outOfStockCount() }} agotados
                </span>
              </div>
            }
          </div>
        </div>
      </div>
    } @else {
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <!-- Unidades en Local -->
        <div
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5 flex items-center gap-4"
        >
          <div
            class="size-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary shrink-0"
          >
            <i-lucide [img]="icons.Package" class="size-6" />
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <span class="text-sm text-surface-500 dark:text-surface-400">Unidades en Local</span>
            @if (allItemsLoading()) {
              <p-skeleton width="5rem" height="1.75rem" />
            } @else {
              <span class="text-2xl font-bold text-surface-900 dark:text-surface-0 leading-tight">
                {{ totalUnits() }}
              </span>
            }
          </div>
        </div>

        <!-- SKUs Activos -->
        <div
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5 flex items-center gap-4"
        >
          <div
            class="size-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shrink-0"
          >
            <i-lucide [img]="icons.Tags" class="size-6" />
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <span class="text-sm text-surface-500 dark:text-surface-400">SKUs Activos</span>
            @if (kpiLoading()) {
              <p-skeleton width="4rem" height="1.75rem" />
            } @else {
              <span class="text-2xl font-bold text-surface-900 dark:text-surface-0 leading-tight">
                {{ activeSkus() }}
              </span>
            }
          </div>
        </div>

        <!-- Alertas Activas -->
        <div
          class="bg-surface-0 dark:bg-surface-800 border-2 rounded-xl p-5 flex items-center gap-4"
          [class.border-red-200]="alertsCount() > 0"
          [class.dark:border-red-900]="alertsCount() > 0"
          [class.border-surface-200]="alertsCount() === 0"
          [class.dark:border-surface-700]="alertsCount() === 0"
        >
          <div
            class="size-12 rounded-xl flex items-center justify-center shrink-0"
            [class.bg-red-100]="alertsCount() > 0"
            [class.dark:bg-red-900]="alertsCount() > 0"
            [class.text-red-600]="alertsCount() > 0"
            [class.dark:text-red-300]="alertsCount() > 0"
            [class.bg-surface-100]="alertsCount() === 0"
            [class.dark:bg-surface-700]="alertsCount() === 0"
            [class.text-surface-500]="alertsCount() === 0"
          >
            <i-lucide [img]="icons.AlertTriangle" class="size-6" />
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <span class="text-sm text-surface-500 dark:text-surface-400">Alertas Activas</span>
            @if (kpiLoading()) {
              <p-skeleton width="4rem" height="1.75rem" />
            } @else {
              <span
                class="text-2xl font-bold leading-tight"
                [class.text-red-600]="alertsCount() > 0"
                [class.dark:text-red-300]="alertsCount() > 0"
                [class.text-surface-900]="alertsCount() === 0"
                [class.dark:text-surface-0]="alertsCount() === 0"
              >
                {{ alertsCount() }}
              </span>
            }
          </div>
        </div>

        <!-- Valor Inventario -->
        <div
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5 flex items-center gap-4"
        >
          <div
            class="size-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0"
          >
            <i-lucide [img]="icons.Wallet" class="size-6" />
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <span class="text-sm text-surface-500 dark:text-surface-400">Valor Inventario</span>
            @if (allItemsLoading()) {
              <p-skeleton width="6rem" height="1.75rem" />
            } @else {
              <span
                class="text-xl font-bold text-surface-900 dark:text-surface-0 leading-tight truncate"
                [pTooltip]="inventoryValueFormatted()"
                tooltipPosition="bottom"
              >
                {{ inventoryValueFormatted() }}
              </span>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class InventoryKpisComponent {
  private readonly products = inject(ProductsService);
  private readonly movements = inject(StockMovementsService);

  readonly variant = input.required<Variant>();

  protected readonly icons = { Package, ArrowRightLeft, AlertTriangle, Tags, Wallet };

  protected readonly kpiCounts = this.products.kpiCounts;
  protected readonly kpiLoading = this.products.kpiLoading;
  protected readonly allItems = this.products.allItems;
  protected readonly allItemsLoading = this.products.allItemsLoading;
  protected readonly todaySummary = this.movements.todaySummary;
  protected readonly todaySummaryLoading = this.movements.todaySummaryLoading;

  protected readonly criticalCount = computed(() => this.kpiCounts().critical);
  protected readonly outOfStockCount = computed(() => this.kpiCounts().outOfStock);
  protected readonly alertsCount = computed(
    () => this.kpiCounts().critical + this.kpiCounts().outOfStock,
  );
  protected readonly activeSkus = computed(() => this.kpiCounts().total);

  // Total units across all currently-loaded items. For 'store' variant we
  // sum from kpiCounts when allItems isn't loaded; for 'brand' variant we
  // always have allItems loaded.
  protected readonly totalUnits = computed(() => {
    const items = this.allItems();
    if (items.length > 0) {
      return formatNumber(items.reduce((acc, p) => acc + p.currentStock, 0));
    }
    return formatNumber(0);
  });

  protected readonly inventoryValueFormatted = computed(() =>
    formatCurrencyUYU(this.allItems().reduce((acc, p) => acc + p.price * p.currentStock, 0)),
  );

  protected readonly todayInboundUnits = computed(() =>
    formatNumber(this.todaySummary().inboundUnits),
  );
  protected readonly todayOutboundUnits = computed(() =>
    formatNumber(this.todaySummary().outboundUnits),
  );
  protected readonly todayMovementsCountLabel = computed(() => {
    const count = this.todaySummary().totalCount;
    return count === 1 ? '1 movimiento' : `${formatNumber(count)} movimientos`;
  });
  protected readonly todayMovementsTooltip = computed(
    () => `${this.todayMovementsCountLabel()} registrados hoy.`,
  );
}
