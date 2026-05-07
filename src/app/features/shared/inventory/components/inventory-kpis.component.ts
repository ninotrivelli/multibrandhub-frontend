import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import {
  AlertTriangle,
  Hourglass,
  LucideAngularModule,
  Package,
  Tags,
  Wallet,
} from 'lucide-angular';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';

import { formatCurrencyUYU, formatNumber } from '../inventory.utils';
import { KpiFilter } from '../inventory.types';
import { ProductsService } from '../products.service';

type Variant = 'store' | 'brand';

@Component({
  selector: 'app-inventory-kpis',
  imports: [LucideAngularModule, SkeletonModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'store') {
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <!-- Total en Local -->
        <button
          type="button"
          class="bg-surface-0 dark:bg-surface-800 border-2 rounded-xl p-5 flex items-center gap-4 text-left transition-colors hover:bg-surface-50 dark:hover:bg-surface-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          [class.border-primary]="activeKpi() === 'all'"
          [class.border-surface-200]="activeKpi() !== 'all'"
          [class.dark:border-surface-700]="activeKpi() !== 'all'"
          (click)="kpiSelected.emit('all')"
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
        </button>

        <!-- Stock Inmovilizado -->
        <button
          type="button"
          class="bg-surface-0 dark:bg-surface-800 border-2 rounded-xl p-5 flex items-center gap-4 text-left transition-colors hover:bg-surface-50 dark:hover:bg-surface-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          [class.border-primary]="activeKpi() === 'immobilized'"
          [class.border-surface-200]="activeKpi() !== 'immobilized'"
          [class.dark:border-surface-700]="activeKpi() !== 'immobilized'"
          [pTooltip]="immobilizedTooltip()"
          tooltipPosition="bottom"
          (click)="kpiSelected.emit('immobilized')"
        >
          <div
            class="size-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0"
          >
            <i-lucide [img]="icons.Hourglass" class="size-6" />
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <span class="text-sm text-surface-500 dark:text-surface-400">Stock Inmovilizado</span>
            @if (immobilizedLoading()) {
              <p-skeleton width="6rem" height="1.75rem" />
            } @else {
              <span class="text-2xl font-bold text-surface-900 dark:text-surface-0 leading-tight">
                {{ formatNumberFn(immobilizedCount()) }}
                <span class="text-sm font-normal text-surface-500 dark:text-surface-400">
                  artíc.
                </span>
              </span>
              <span class="text-xs text-surface-500 dark:text-surface-400">
                +60 días sin ventas
              </span>
            }
          </div>
        </button>

        <!-- Alertas Activas -->
        <button
          type="button"
          class="bg-surface-0 dark:bg-surface-800 border-2 rounded-xl p-5 flex items-center gap-4 text-left transition-colors hover:bg-surface-50 dark:hover:bg-surface-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          [class.border-primary]="activeKpi() === 'alerts'"
          [class.border-red-200]="activeKpi() !== 'alerts' && alertsCount() > 0"
          [class.dark:border-red-900]="activeKpi() !== 'alerts' && alertsCount() > 0"
          [class.border-surface-200]="activeKpi() !== 'alerts' && alertsCount() === 0"
          [class.dark:border-surface-700]="activeKpi() !== 'alerts' && alertsCount() === 0"
          (click)="kpiSelected.emit('alerts')"
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
        </button>
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

  readonly variant = input.required<Variant>();
  readonly activeKpi = input<KpiFilter>('all');
  readonly kpiSelected = output<KpiFilter>();

  protected readonly icons = { Package, Hourglass, AlertTriangle, Tags, Wallet };
  protected readonly formatNumberFn = formatNumber;

  protected readonly kpiCounts = this.products.kpiCounts;
  protected readonly kpiLoading = this.products.kpiLoading;
  protected readonly allItems = this.products.allItems;
  protected readonly allItemsLoading = this.products.allItemsLoading;
  protected readonly immobilizedCount = this.products.immobilizedCount;
  protected readonly immobilizedLoading = this.products.immobilizedLoading;

  protected readonly criticalCount = computed(() => this.kpiCounts().critical);
  protected readonly outOfStockCount = computed(() => this.kpiCounts().outOfStock);
  protected readonly alertsCount = computed(
    () => this.kpiCounts().critical + this.kpiCounts().outOfStock,
  );
  protected readonly activeSkus = computed(() => this.kpiCounts().total);

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

  protected readonly immobilizedTooltip = computed(() => {
    const n = this.immobilizedCount();
    if (n === 0) return 'No hay artículos inmovilizados (+60 días sin ventas).';
    return `${formatNumber(n)} ${n === 1 ? 'artículo' : 'artículos'} sin ventas hace +60 días. Click para filtrar.`;
  });
}
