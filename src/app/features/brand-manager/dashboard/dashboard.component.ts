import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  LucideAngularModule,
  LucideIconData,
  PackageSearch,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  WalletCards,
} from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';
import { BrandsService } from '../../../core/brands/brands.service';
import { SalesService } from '../../../core/sales/sales.service';
import {
  SalesDashboardDailySalesResponse,
  SalesDashboardResponse,
  SalesDashboardSaleResponse,
  TopSellingProductResponse,
  TopSellingProductsResponse,
} from '../../../core/sales/sales.types';
import {
  paymentMethodIcon,
  paymentMethodLabel,
  SaleTagSeverity,
  saleTypeStatusLabel,
  saleTypeStatusSeverity,
} from '../../../core/sales/sales.utils';
import { SettlementsService } from '../../../core/settlements/settlements.service';
import { BrandSettlementResponse } from '../../../core/settlements/settlements.types';
import { ProductsService } from '../../shared/inventory/products.service';
import { ProductResponse } from '../../shared/inventory/inventory.types';
import {
  URUGUAY_TIME_ZONE,
  computeStockStatus,
  formatCurrencyUYU,
  formatNumber,
  formatShortDate,
  formatUruguayDate,
  parseBackendUtcDate,
} from '../../shared/inventory/inventory.utils';
import {
  DateRange,
  defaultWeekStartForRange,
  formatRangeSummary,
  formatShortDateOnly,
  formatWeekday,
  normalizeDateRange,
} from '../../shared/sales-dashboard/sales-dashboard.utils';
import { currentFullMonthRange } from '../../shared/settlements/settlements.utils';

type RankingRangePreset = 'currentMonth' | 'last3Months' | 'last6Months' | 'custom';
type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';
type BalanceTone = 'success' | 'info' | 'warn' | 'secondary';

interface WeeklySalesItem extends SalesDashboardDailySalesResponse {
  weekday: string;
  shortDate: string;
}

interface RankingRangeOption {
  label: string;
  value: RankingRangePreset;
}

interface QuickAction {
  label: string;
  detail: string;
  routerLink: string;
  queryParams?: Record<string, string>;
  icon: LucideIconData;
}

interface BalanceView {
  label: string;
  detail: string;
  amount: number;
  severity: BalanceTone;
}

@Component({
  selector: 'app-brand-manager-dashboard',
  imports: [
    NgClass,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    SkeletonModule,
    TagModule,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
})
export class BrandManagerDashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly brands = inject(BrandsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sales = inject(SalesService);
  private readonly settlements = inject(SettlementsService);
  private readonly products = inject(ProductsService);

  protected readonly icons = {
    AlertTriangle,
    ArrowRight,
    BadgeCheck,
    BadgeDollarSign,
    BarChart3,
    CalendarDays,
    CheckCircle2,
    PackageSearch,
    RefreshCw,
    ShoppingBag,
    TrendingUp,
    WalletCards,
  };

  protected readonly user = this.auth.user;
  protected readonly brandsList = this.brands.items;
  protected readonly brandsLoading = this.brands.loading;
  protected readonly kpiCounts = this.products.kpiCounts;
  protected readonly kpiLoading = this.products.kpiLoading;

  protected readonly today = formatUruguayDate();
  protected readonly monthRange = currentFullMonthRange(this.today);
  protected readonly rankingOptions: RankingRangeOption[] = [
    { label: 'Mes actual', value: 'currentMonth' },
    { label: 'Últimos 3 meses', value: 'last3Months' },
    { label: 'Últimos 6 meses', value: 'last6Months' },
    { label: 'Personalizado', value: 'custom' },
  ];

  protected readonly rankingPreset = signal<RankingRangePreset>('currentMonth');
  protected readonly rankingStartDate = signal(this.monthRange.startDate);
  protected readonly rankingEndDate = signal(this.monthRange.endDate);
  protected readonly dashboard = signal<SalesDashboardResponse | null>(null);
  protected readonly topProducts = signal<TopSellingProductsResponse | null>(null);
  protected readonly settlement = signal<BrandSettlementResponse | null>(null);
  protected readonly stockAlerts = signal<ProductResponse[]>([]);
  protected readonly dashboardLoading = signal(false);
  protected readonly topProductsLoading = signal(false);
  protected readonly settlementLoading = signal(false);
  protected readonly stockAlertsLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly brandId = computed(() => this.user()?.brandId ?? null);
  protected readonly missingBrandScope = computed(() => !this.brandId());
  protected readonly brandName = computed(() => {
    const brandId = this.brandId();
    if (!brandId) return 'tu marca';

    return (
      this.brandsList().find((brand) => brand.id === brandId)?.name ??
      this.settlement()?.brandName ??
      this.topProducts()?.items[0]?.brandName ??
      this.dashboard()?.brandDistribution.find((brand) => brand.brandId === brandId)?.brandName ??
      'tu marca'
    );
  });
  protected readonly loading = computed(
    () =>
      this.dashboardLoading() ||
      this.topProductsLoading() ||
      this.settlementLoading() ||
      this.stockAlertsLoading() ||
      this.kpiLoading() ||
      this.brandsLoading(),
  );
  protected readonly monthNetSales = computed(() => this.dashboard()?.kpis.netSalesAmount ?? 0);
  protected readonly monthNetUnits = computed(() => this.dashboard()?.kpis.netUnits ?? 0);
  protected readonly monthTicketCount = computed(() => this.dashboard()?.kpis.saleTicketCount ?? 0);
  protected readonly averageTicket = computed(
    () => this.dashboard()?.kpis.averageNetTicketAmount ?? 0,
  );
  protected readonly weeklySales = computed<WeeklySalesItem[]>(() =>
    (this.dashboard()?.dailySales ?? []).map((item) => ({
      ...item,
      weekday: formatWeekday(item.date),
      shortDate: formatShortDateOnly(item.date),
    })),
  );
  protected readonly maxWeeklySales = computed(() =>
    Math.max(0, ...this.weeklySales().map((item) => item.netSalesAmount)),
  );
  protected readonly recentSales = computed(() => (this.dashboard()?.sales.items ?? []).slice(0, 5));
  protected readonly topProductItems = computed(() => this.topProducts()?.items ?? []);
  protected readonly starProduct = computed(() => this.topProductItems()[0] ?? null);
  protected readonly remainingTopProducts = computed(() => this.topProductItems().slice(1));
  protected readonly topProductMaxUnits = computed(() =>
    Math.max(0, ...this.topProductItems().map((item) => item.netUnitsSold)),
  );
  protected readonly rankingRangeLabel = computed(() =>
    formatRangeSummary(this.rankingStartDate(), this.rankingEndDate()),
  );
  protected readonly topProductsSalesQuery = computed(() => ({
    from: this.rankingStartDate(),
    to: this.rankingEndDate(),
  }));
  protected readonly stockAlertCount = computed(
    () => this.kpiCounts().critical + this.kpiCounts().outOfStock,
  );
  protected readonly balance = computed<BalanceView>(() => {
    const settlement = this.settlement();
    if (!settlement) {
      return {
        label: 'Sin estimación',
        detail: 'Todavía no se pudo calcular el balance del mes.',
        amount: 0,
        severity: 'secondary',
      };
    }

    if (settlement.amountBrandOwesStore > 0) {
      return {
        label: 'A pagar al local',
        detail: 'El efectivo retenido no cubre comisión y alquiler.',
        amount: settlement.amountBrandOwesStore,
        severity: 'warn',
      };
    }

    if (settlement.amountBrandOwesStore < 0) {
      return {
        label: 'A favor de tu marca',
        detail: 'El local retuvo más efectivo que lo que tiene que cobrar.',
        amount: Math.abs(settlement.amountBrandOwesStore),
        severity: 'info',
      };
    }

    return {
      label: 'Sin saldo pendiente',
      detail: 'El balance estimado queda saldado para este mes.',
      amount: 0,
      severity: 'success',
    };
  });
  protected readonly quickActions: QuickAction[] = [
    {
      label: 'Ver mis ventas',
      detail: 'Tickets y devoluciones de tu marca.',
      routerLink: '/brand-manager/sales',
      icon: TrendingUp,
    },
    {
      label: 'Revisar stock',
      detail: 'Productos críticos o agotados.',
      routerLink: '/brand-manager/inventory',
      queryParams: { kpi: 'alerts' },
      icon: PackageSearch,
    },
    {
      label: 'Liquidaciones',
      detail: 'Balance guardado y detalle mensual.',
      routerLink: '/brand-manager/settlements',
      icon: BadgeDollarSign,
    },
  ];

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    this.error.set(null);

    if (this.missingBrandScope()) {
      this.error.set('Tu usuario no tiene una marca asociada.');
      return;
    }

    this.loadBrandName();
    this.loadMonthlySales();
    this.loadTopProducts();
    this.loadSettlementEstimate();
    this.loadStockAlerts();
  }

  protected setRankingPreset(preset: RankingRangePreset): void {
    this.rankingPreset.set(preset);
    if (preset === 'custom') return;

    const range = this.rankingRangeForPreset(preset);
    this.applyRankingRange(range);
  }

  protected setCustomStartDate(value: string): void {
    if (!value) return;
    this.rankingPreset.set('custom');
    this.applyRankingRange(normalizeDateRange(value, this.rankingEndDate()));
  }

  protected setCustomEndDate(value: string): void {
    if (!value) return;
    this.rankingPreset.set('custom');
    this.applyRankingRange(normalizeDateRange(this.rankingStartDate(), value));
  }

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }

  protected formatNumber(value: number): string {
    return formatNumber(value);
  }

  protected weeklyBarHeight(value: number): string {
    const max = this.maxWeeklySales();
    if (max <= 0) return '0.75rem';
    return `${Math.max(0.75, (value / max) * 7.5)}rem`;
  }

  protected weeklyBarTitle(day: WeeklySalesItem): string {
    return `${day.weekday} ${day.shortDate}: ${this.formatCurrency(day.netSalesAmount)}`;
  }

  protected weeklyBarValueLabel(day: WeeklySalesItem): string {
    return this.formatShortCurrency(day.netSalesAmount);
  }

  protected productBarWidth(item: TopSellingProductResponse): string {
    const max = this.topProductMaxUnits();
    if (max <= 0) return '0%';
    return `${Math.max(8, (item.netUnitsSold / max) * 100)}%`;
  }

  protected rankingButtonClasses(value: RankingRangePreset): string {
    const active = this.rankingPreset() === value;
    return active
      ? 'border-primary bg-primary text-primary-contrast'
      : 'border-surface-200 bg-surface-0 text-surface-600 hover:border-primary/50 hover:text-primary dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300';
  }

  protected balanceClasses(severity: BalanceTone): string {
    switch (severity) {
      case 'warn':
        return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100';
      case 'info':
        return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100';
      case 'success':
        return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100';
      case 'secondary':
        return 'border-surface-200 bg-surface-50 text-surface-700 dark:border-surface-700 dark:bg-surface-700/40 dark:text-surface-100';
    }
  }

  protected balanceSeverity(severity: BalanceTone): TagSeverity {
    return severity;
  }

  protected stockStatusLabel(product: ProductResponse): string {
    return computeStockStatus(product.currentStock, product.minStockAlert);
  }

  protected stockStatusSeverity(product: ProductResponse): TagSeverity {
    return product.currentStock <= 0 ? 'danger' : 'warn';
  }

  protected formatSaleTime(row: SalesDashboardSaleResponse): string {
    return this.formatTime(row.date);
  }

  protected formatSaleDate(row: SalesDashboardSaleResponse): string {
    return formatShortDate(row.date);
  }

  protected saleStatusLabel(row: SalesDashboardSaleResponse): string {
    return saleTypeStatusLabel(row.type, row.status);
  }

  protected saleStatusSeverity(row: SalesDashboardSaleResponse): SaleTagSeverity {
    return saleTypeStatusSeverity(row.type, row.status);
  }

  protected paymentLabel(row: SalesDashboardSaleResponse): string {
    return paymentMethodLabel(row.paymentMethod);
  }

  protected paymentIcon(row: SalesDashboardSaleResponse): LucideIconData {
    return paymentMethodIcon(row.paymentMethod);
  }

  private loadBrandName(): void {
    if (!this.brands.hasItems()) {
      this.brands.list({ page: 1, pageSize: 100, includeArchived: true }).subscribe({
        error: () => {
          // Header falls back to "tu marca"; the global interceptor handles the toast.
        },
      });
    }
  }

  private loadMonthlySales(): void {
    const brandId = this.brandId();
    if (!brandId) return;

    this.dashboardLoading.set(true);
    this.sales
      .getDashboard({
        from: this.monthRange.startDate,
        to: this.monthRange.endDate,
        chartWeekStart: defaultWeekStartForRange(
          this.monthRange.startDate,
          this.monthRange.endDate,
          this.today,
        ),
        brandIds: [brandId],
        page: 1,
        pageSize: 5,
      })
      .pipe(
        finalize(() => this.dashboardLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (dashboard) => this.dashboard.set(dashboard),
        error: () => {
          this.dashboard.set(null);
          this.error.set('No se pudo cargar el resumen de ventas.');
        },
      });
  }

  private loadTopProducts(): void {
    const brandId = this.brandId();
    if (!brandId) return;

    this.topProductsLoading.set(true);
    this.sales
      .getTopProducts({
        from: this.rankingStartDate(),
        to: this.rankingEndDate(),
        brandId,
        limit: 10,
      })
      .pipe(
        finalize(() => this.topProductsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.topProducts.set(response),
        error: () => {
          this.topProducts.set(null);
          this.error.set('No se pudo cargar el ranking de productos.');
        },
      });
  }

  private loadSettlementEstimate(): void {
    const brandId = this.brandId();
    if (!brandId) return;

    this.settlementLoading.set(true);
    this.settlements
      .getByBrand(brandId, {
        from: this.monthRange.startDate,
        to: this.monthRange.endDate,
      })
      .pipe(
        finalize(() => this.settlementLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (settlement) => this.settlement.set(settlement),
        error: () => {
          this.settlement.set(null);
          this.error.set('No se pudo cargar la liquidación estimada.');
        },
      });
  }

  private loadStockAlerts(): void {
    const brandId = this.brandId();
    if (!brandId) return;

    this.products
      .loadKpiCounts(brandId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.error.set('No se pudieron cargar los indicadores de stock.'),
      });

    this.stockAlertsLoading.set(true);
    this.products
      .searchOnce({
        brandId,
        stockStatuses: ['Critical', 'OutOfStock'],
        page: 1,
        pageSize: 5,
        sortBy: 'name',
        sortDirection: 'asc',
      })
      .pipe(
        finalize(() => this.stockAlertsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.stockAlerts.set(response.items),
        error: () => {
          this.stockAlerts.set([]);
          this.error.set('No se pudo cargar el stock a revisar.');
        },
      });
  }

  private applyRankingRange(range: DateRange): void {
    this.rankingStartDate.set(range.startDate);
    this.rankingEndDate.set(range.endDate);
    this.loadTopProducts();
  }

  private rankingRangeForPreset(preset: Exclude<RankingRangePreset, 'custom'>): DateRange {
    if (preset === 'currentMonth') return this.monthRange;
    return this.fullMonthRangeIncludingCurrent(preset === 'last3Months' ? 3 : 6);
  }

  private fullMonthRangeIncludingCurrent(monthCount: number): DateRange {
    const current = this.dateFromDateOnly(this.today);
    const start = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - (monthCount - 1), 1),
    );
    const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
    return {
      startDate: this.formatDateOnly(start),
      endDate: this.formatDateOnly(end),
    };
  }

  private dateFromDateOnly(dateOnly: string): Date {
    const [year, month, day] = dateOnly.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private formatDateOnly(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTime(iso: string): string {
    return new Intl.DateTimeFormat('es-UY', {
      timeZone: URUGUAY_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(parseBackendUtcDate(iso));
  }

  private formatShortCurrency(value: number): string {
    const sign = value < 0 ? '-' : '';
    const amount = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(
      Math.abs(value),
    );
    return `${sign}$${amount}`;
  }
}
