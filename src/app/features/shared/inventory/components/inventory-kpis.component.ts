import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
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
  templateUrl: './inventory-kpis.component.html',
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
