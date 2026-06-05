import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { RefreshCw, LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';
import { BrandsService } from '../../../core/brands/brands.service';
import { SalesService } from '../../../core/sales/sales.service';
import {
  SalesDashboardRequest,
  SalesDashboardResponse,
} from '../../../core/sales/sales.types';
import { SalesDashboardFilterBarComponent } from './sales-dashboard-filter-bar.component';
import { SalesDashboardKpisComponent } from './sales-dashboard-kpis.component';
import { SalesWeeklyChartComponent } from './sales-weekly-chart.component';
import { SalesBrandDistributionChartComponent } from './sales-brand-distribution-chart.component';
import { SalesDashboardListComponent } from './sales-dashboard-list.component';
import {
  SalesDashboardPeriodPreset,
  SalesDashboardVariant,
  addDays,
  clampWeekStart,
  compareDateOnly,
  currentMonthRange,
  defaultWeekStartForRange,
  normalizeDateRange,
  periodRangeForPreset,
  weekNavigationBounds,
} from './sales-dashboard.utils';

@Component({
  selector: 'app-sales-dashboard-shell',
  imports: [
    ButtonModule,
    LucideAngularModule,
    SalesDashboardFilterBarComponent,
    SalesDashboardKpisComponent,
    SalesWeeklyChartComponent,
    SalesBrandDistributionChartComponent,
    SalesDashboardListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-dashboard-shell.component.html',
})
export class SalesDashboardShellComponent {
  private readonly auth = inject(AuthService);
  private readonly brands = inject(BrandsService);
  private readonly sales = inject(SalesService);

  readonly variant = input.required<SalesDashboardVariant>();

  protected readonly icons = { RefreshCw };
  protected readonly brandsList = this.brands.items;
  protected readonly currentUser = this.auth.user;

  protected readonly periodPreset = signal<SalesDashboardPeriodPreset>('currentMonth');
  protected readonly startDate = signal(currentMonthRange().startDate);
  protected readonly endDate = signal(currentMonthRange().endDate);
  protected readonly selectedBrandIds = signal<string[]>([]);
  protected readonly chartWeekStart = signal(
    defaultWeekStartForRange(currentMonthRange().startDate, currentMonthRange().endDate),
  );
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly dashboard = signal<SalesDashboardResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly fetchTrigger$ = new Subject<SalesDashboardRequest>();

  protected readonly isAdmin = computed(() => this.variant() === 'admin');

  protected readonly brandScopeId = computed(() =>
    this.variant() === 'brand-manager' ? (this.currentUser()?.brandId ?? null) : null,
  );

  protected readonly requestBrandIds = computed(() => {
    const scope = this.brandScopeId();
    if (scope) return [scope];
    return this.selectedBrandIds();
  });

  protected readonly currentRequest = computed<SalesDashboardRequest | null>(() => {
    if (this.variant() === 'brand-manager' && !this.brandScopeId()) return null;
    return {
      from: this.startDate(),
      to: this.endDate(),
      brandIds: this.requestBrandIds(),
      chartWeekStart: this.chartWeekStart(),
      page: this.page(),
      pageSize: this.pageSize(),
    };
  });

  protected readonly weekBounds = computed(() =>
    weekNavigationBounds(this.startDate(), this.endDate()),
  );

  protected readonly canMovePreviousWeek = computed(
    () => compareDateOnly(this.chartWeekStart(), this.weekBounds().minWeekStart) > 0,
  );

  protected readonly canMoveNextWeek = computed(
    () => compareDateOnly(this.chartWeekStart(), this.weekBounds().maxWeekStart) < 0,
  );

  protected readonly hasAnyFilter = computed(
    () =>
      this.periodPreset() !== 'currentMonth' ||
      this.selectedBrandIds().length > 0 ||
      this.variant() === 'brand-manager',
  );

  constructor() {
    this.fetchTrigger$
      .pipe(
        switchMap((request) => {
          this.loading.set(true);
          this.error.set(null);
          return this.sales.getDashboard(request).pipe(
            tap({
              next: (response) => {
                this.dashboard.set(response);
                this.loading.set(false);
              },
              error: () => {
                this.error.set('No se pudo cargar el panel de ventas. Probá de nuevo.');
                this.loading.set(false);
              },
            }),
            catchError(() => EMPTY),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    effect(() => {
      const request = this.currentRequest();
      if (!request) return;
      untracked(() => this.fetchTrigger$.next(request));
    });
  }

  ngOnInit(): void {
    if (!this.brands.hasItems()) {
      this.brands.list({ page: 1, pageSize: 100 }).subscribe({ error: () => {} });
    }
  }

  protected setPeriodPreset(preset: SalesDashboardPeriodPreset): void {
    this.periodPreset.set(preset);
    if (preset === 'custom') return;

    const range = periodRangeForPreset(preset);
    this.applyDateRange(range.startDate, range.endDate);
  }

  protected setCustomStartDate(value: string): void {
    if (!value) return;
    this.periodPreset.set('custom');
    const range = normalizeDateRange(value, this.endDate());
    this.applyDateRange(range.startDate, range.endDate);
  }

  protected setCustomEndDate(value: string): void {
    if (!value) return;
    this.periodPreset.set('custom');
    const range = normalizeDateRange(this.startDate(), value);
    this.applyDateRange(range.startDate, range.endDate);
  }

  protected selectAllBrands(): void {
    this.selectedBrandIds.set([]);
    this.page.set(1);
  }

  protected toggleBrand(brandId: string): void {
    this.selectedBrandIds.update((current) =>
      current.includes(brandId)
        ? current.filter((selected) => selected !== brandId)
        : [...current, brandId],
    );
    this.page.set(1);
  }

  protected movePreviousWeek(): void {
    if (!this.canMovePreviousWeek()) return;
    this.chartWeekStart.set(
      clampWeekStart(addDays(this.chartWeekStart(), -7), this.startDate(), this.endDate()),
    );
  }

  protected moveNextWeek(): void {
    if (!this.canMoveNextWeek()) return;
    this.chartWeekStart.set(
      clampWeekStart(addDays(this.chartWeekStart(), 7), this.startDate(), this.endDate()),
    );
  }

  protected onPageChange(event: { page: number; pageSize: number }): void {
    this.page.set(event.page);
    this.pageSize.set(event.pageSize);
  }

  protected retry(): void {
    const request = this.currentRequest();
    if (request) this.fetchTrigger$.next(request);
  }

  private applyDateRange(startDate: string, endDate: string): void {
    this.startDate.set(startDate);
    this.endDate.set(endDate);
    this.chartWeekStart.set(defaultWeekStartForRange(startDate, endDate));
    this.page.set(1);
  }
}
