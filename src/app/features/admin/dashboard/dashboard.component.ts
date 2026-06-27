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
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LucideAngularModule,
  LucideIconData,
  PackageSearch,
  Plus,
  Receipt,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  WalletCards,
} from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';
import { CashRegisterService } from '../../../core/cash-register/cash-register.service';
import { CashRegisterSessionResponse } from '../../../core/cash-register/cash-register.types';
import { NotificationService } from '../../../core/notifications/notification.service';
import { SalesService } from '../../../core/sales/sales.service';
import {
  SalesDashboardDailySalesResponse,
  SalesDashboardResponse,
  SalesDashboardSaleResponse,
  SalesSummaryResponse,
} from '../../../core/sales/sales.types';
import {
  paymentMethodIcon,
  paymentMethodLabel,
  SaleTagSeverity,
  saleTypeStatusLabel,
  saleTypeStatusSeverity,
} from '../../../core/sales/sales.utils';
import { StoreTaskResponse } from '../../../core/tasks/tasks.types';
import { TasksService } from '../../../core/tasks/tasks.service';
import { sortPendingTasks } from '../../../core/tasks/tasks.utils';
import { BrandChipComponent } from '../../../shared/components/brand-chip/brand-chip.component';
import { ProductsService } from '../../shared/inventory/products.service';
import {
  URUGUAY_TIME_ZONE,
  formatCurrencyUYU,
  formatNumber,
  formatShortDate,
  formatUruguayDate,
  parseBackendUtcDate,
} from '../../shared/inventory/inventory.utils';
import {
  currentMonthRange,
  defaultWeekStartForRange,
  formatShortDateOnly,
  formatWeekday,
} from '../../shared/sales-dashboard/sales-dashboard.utils';
import { TaskListComponent } from '../../shared/tasks/task-list/task-list.component';

type AttentionSeverity = 'danger' | 'warn' | 'success';

interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  severity: AttentionSeverity;
  icon: LucideIconData;
  routerLink?: string;
  queryParams?: Record<string, string>;
  actionLabel?: string;
}

interface WeeklySalesItem extends SalesDashboardDailySalesResponse {
  weekday: string;
  shortDate: string;
}

interface CashStatusView {
  label: string;
  detail: string;
  severity: 'success' | 'warn' | 'danger' | 'secondary';
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [
    NgClass,
    RouterLink,
    ButtonModule,
    SkeletonModule,
    TagModule,
    LucideAngularModule,
    BrandChipComponent,
    TaskListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sales = inject(SalesService);
  private readonly products = inject(ProductsService);
  private readonly cashRegister = inject(CashRegisterService);
  private readonly tasks = inject(TasksService);
  private readonly notifications = inject(NotificationService);

  protected readonly icons = {
    AlertTriangle,
    ArrowRight,
    BadgeCheck,
    BarChart3,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    PackageSearch,
    Plus,
    Receipt,
    RefreshCw,
    ShoppingBag,
    TrendingUp,
    WalletCards,
  };

  protected readonly user = this.auth.user;
  protected readonly today = formatUruguayDate();
  protected readonly todaySalesQuery = { from: this.today, to: this.today };

  private readonly monthRange = currentMonthRange(this.today);

  protected readonly todaySummary = signal<SalesSummaryResponse | null>(null);
  protected readonly dashboard = signal<SalesDashboardResponse | null>(null);
  protected readonly todayLoading = signal(false);
  protected readonly dashboardLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly completingIds = signal<ReadonlySet<string>>(new Set<string>());

  protected readonly kpiCounts = this.products.kpiCounts;
  protected readonly kpiLoading = this.products.kpiLoading;
  protected readonly immobilizedCount = this.products.immobilizedCount;
  protected readonly immobilizedLoading = this.products.immobilizedLoading;
  protected readonly cashCurrent = this.cashRegister.current;
  protected readonly cashLoaded = this.cashRegister.currentLoaded;
  protected readonly cashLoading = this.cashRegister.currentLoading;
  protected readonly tasksLoading = this.tasks.loading;

  protected readonly salesLoading = computed(() => this.todayLoading() || this.dashboardLoading());
  protected readonly alertsCount = computed(
    () => this.kpiCounts().critical + this.kpiCounts().outOfStock,
  );
  protected readonly pendingTasks = computed(() => sortPendingTasks(this.tasks.pending()).slice(0, 5));
  protected readonly pendingTaskCount = computed(() => this.tasks.pending().length);
  protected readonly highPriorityTaskCount = computed(
    () => this.tasks.pending().filter((task) => task.priority === 'High').length,
  );
  protected readonly monthNetSales = computed(() => this.dashboard()?.kpis.netSalesAmount ?? 0);
  protected readonly monthTicketCount = computed(() => this.dashboard()?.kpis.saleTicketCount ?? 0);
  protected readonly averageTicket = computed(
    () => this.dashboard()?.kpis.averageGrossTicketAmount ?? 0,
  );
  protected readonly averageNetTicket = computed(
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
  protected readonly topBrands = computed(() =>
    [...(this.dashboard()?.brandDistribution ?? [])]
      .filter((brand) => brand.netSalesAmount > 0)
      .sort((a, b) => b.netSalesAmount - a.netSalesAmount)
      .slice(0, 4),
  );
  protected readonly topBrandMax = computed(() =>
    Math.max(0, ...this.topBrands().map((brand) => brand.netSalesAmount)),
  );
  protected readonly recentSales = computed(() => (this.dashboard()?.sales.items ?? []).slice(0, 5));
  protected readonly cashStatus = computed<CashStatusView>(() => {
    if (this.cashLoading() || !this.cashLoaded()) {
      return {
        label: 'Cargando caja',
        detail: 'Consultando el estado actual.',
        severity: 'secondary',
      };
    }

    const session = this.cashCurrent();
    if (!session) {
      return {
        label: 'Caja cerrada',
        detail: 'Abrí caja antes de arrancar la operativa.',
        severity: 'warn',
      };
    }

    if (this.isOpenFromPreviousDay(session)) {
      return {
        label: 'Caja abierta desde ayer',
        detail: `Abierta ${this.formatDateTime(session.openedAtUtc)}.`,
        severity: 'danger',
      };
    }

    return {
      label: 'Caja abierta hoy',
      detail: `Abierta ${this.formatTime(session.openedAtUtc)}.`,
      severity: 'success',
    };
  });

  protected readonly attentionItems = computed<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const counts = this.kpiCounts();
    const alerts = counts.critical + counts.outOfStock;
    const cash = this.cashCurrent();

    if (alerts > 0) {
      items.push({
        id: 'stock-alerts',
        title: 'Alertas de stock',
        detail: `${formatNumber(counts.critical)} críticos · ${formatNumber(counts.outOfStock)} agotados`,
        severity: 'danger',
        icon: AlertTriangle,
        routerLink: '/admin/inventory',
        queryParams: { kpi: 'alerts' },
        actionLabel: 'Ver stock',
      });
    }

    if (this.cashLoaded() && !cash) {
      items.push({
        id: 'cash-closed',
        title: 'Caja cerrada',
        detail: 'La caja del local todavía no está abierta.',
        severity: 'warn',
        icon: Receipt,
        routerLink: '/admin/cash-register',
        actionLabel: 'Abrir caja',
      });
    } else if (cash && this.isOpenFromPreviousDay(cash)) {
      items.push({
        id: 'cash-old',
        title: 'Caja abierta desde ayer',
        detail: 'Conviene revisar el cierre antes de seguir vendiendo.',
        severity: 'danger',
        icon: Receipt,
        routerLink: '/admin/cash-register',
        actionLabel: 'Revisar caja',
      });
    }

    if (this.immobilizedCount() > 0) {
      items.push({
        id: 'immobilized',
        title: 'Stock inmovilizado',
        detail: `${formatNumber(this.immobilizedCount())} artículos sin ventas hace +60 días.`,
        severity: 'warn',
        icon: PackageSearch,
        routerLink: '/admin/inventory',
        queryParams: { kpi: 'immobilized' },
        actionLabel: 'Analizar',
      });
    }

    if (this.highPriorityTaskCount() > 0) {
      items.push({
        id: 'high-tasks',
        title: 'Tareas de prioridad alta',
        detail: `${formatNumber(this.highPriorityTaskCount())} pendientes para resolver.`,
        severity: 'warn',
        icon: ClipboardList,
        routerLink: '/admin/tasks',
        actionLabel: 'Ver tareas',
      });
    }

    if (items.length === 0 && !this.kpiLoading() && !this.immobilizedLoading()) {
      items.push({
        id: 'clear',
        title: 'Todo bajo control',
        detail: 'No hay alertas críticas para atender ahora.',
        severity: 'success',
        icon: BadgeCheck,
      });
    }

    return items;
  });

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    this.error.set(null);
    this.loadSales();
    this.loadInventory();
    this.loadCashRegister();
    this.loadTasks();
  }

  protected completeTask(task: StoreTaskResponse): void {
    if (this.completingIds().has(task.id)) return;

    this.markCompleting(task.id, true);
    this.tasks
      .complete(task.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.markCompleting(task.id, false);
          this.notifications.success('Tarea completada.');
        },
        error: () => {
          this.markCompleting(task.id, false);
        },
      });
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

  protected brandBarWidth(value: number): string {
    const max = this.topBrandMax();
    if (max <= 0) return '0%';
    return `${Math.max(8, (value / max) * 100)}%`;
  }

  protected brandShare(value: number): string {
    const total = this.monthNetSales();
    if (total <= 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  }

  protected attentionClasses(severity: AttentionSeverity): string {
    switch (severity) {
      case 'danger':
        return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200';
      case 'warn':
        return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200';
      case 'success':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200';
    }
  }

  protected attentionIconClasses(severity: AttentionSeverity): string {
    switch (severity) {
      case 'danger':
        return 'bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-200';
      case 'warn':
        return 'bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-200';
      case 'success':
        return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-200';
    }
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

  private loadSales(): void {
    this.todayLoading.set(true);
    this.sales
      .getSummary({ from: this.today, to: this.today })
      .pipe(
        finalize(() => this.todayLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (summary) => this.todaySummary.set(summary),
        error: () => {
          this.todaySummary.set(null);
          this.error.set('No se pudieron cargar las ventas de hoy.');
        },
      });

    this.dashboardLoading.set(true);
    this.sales
      .getDashboard({
        from: this.monthRange.startDate,
        to: this.monthRange.endDate,
        chartWeekStart: defaultWeekStartForRange(this.monthRange.startDate, this.monthRange.endDate),
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
          this.error.set('No se pudo cargar el resumen del mes.');
        },
      });
  }

  private loadInventory(): void {
    this.products
      .loadKpiCounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.error.set('No se pudieron cargar las alertas de inventario.'),
      });
    this.products
      .loadImmobilizedCount(undefined, 60)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.error.set('No se pudo cargar el stock inmovilizado.'),
      });
  }

  private loadCashRegister(): void {
    this.cashRegister
      .loadCurrent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.error.set('No se pudo cargar el estado de caja.'),
      });
  }

  private loadTasks(): void {
    this.tasks
      .loadPending(['General', 'Personal'])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.error.set('No se pudieron cargar las tareas pendientes.'),
      });
  }

  private markCompleting(id: string, completing: boolean): void {
    this.completingIds.update((current) => {
      const next = new Set(current);
      if (completing) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private isOpenFromPreviousDay(session: CashRegisterSessionResponse): boolean {
    return formatUruguayDate(parseBackendUtcDate(session.openedAtUtc)) < this.today;
  }

  private formatTime(iso: string): string {
    return new Intl.DateTimeFormat('es-UY', {
      timeZone: URUGUAY_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(parseBackendUtcDate(iso));
  }

  private formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat('es-UY', {
      timeZone: URUGUAY_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(parseBackendUtcDate(iso));
  }
}
