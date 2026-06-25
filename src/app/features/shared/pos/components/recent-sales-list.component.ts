import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  switchMap,
} from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { History, LucideAngularModule, LucideIconData, Search, X } from 'lucide-angular';

import { BrandsService } from '../../../../core/brands/brands.service';
import { BrandResponse } from '../../../../core/brands/brands.types';
import { SalesService } from '../../../../core/sales/sales.service';
import {
  CardBrand,
  PaymentMethod,
  SaleSearchParams,
  SaleSearchResponse,
  SaleType,
} from '../../../../core/sales/sales.types';
import {
  cardBrandLabel,
  paymentMethodIcon,
  paymentMethodLabel,
  saleTypeStatusLabel,
  saleTypeStatusSeverity,
  type SaleTagSeverity,
} from '../../../../core/sales/sales.utils';
import { BrandChipComponent } from '../../../../shared/components/brand-chip/brand-chip.component';
import {
  formatCurrencyUYU,
  formatShortDate,
  parseBackendUtcDate,
  relativeDayLabel,
  URUGUAY_TIME_ZONE,
} from '../../inventory/inventory.utils';
import { SaleDetailDialogComponent } from './sale-detail-dialog.component';

@Component({
  selector: 'app-pos-recent-sales-list',
  imports: [
    FormsModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    LucideAngularModule,
    BrandChipComponent,
    SaleDetailDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recent-sales-list.component.html',
})
export class RecentSalesListComponent {
  private readonly sales = inject(SalesService);
  private readonly brands = inject(BrandsService);

  readonly saleChanged = output<string>();
  readonly returnRequested = output<string>();

  protected readonly icons = { History, Search, X };

  protected readonly items = this.sales.recentItems;
  protected readonly totalCount = this.sales.recentTotal;
  protected readonly loading = this.sales.recentLoading;

  // Filters. searchTerm is debounced before it hits the backend; the rest fire
  // immediately. Empty string / null means "no filter".
  protected readonly searchTerm = signal('');
  protected readonly saleType = signal<SaleType | null>(null);
  protected readonly brandId = signal<string | null>(null);
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);

  // Sale-detail modal state. Clicking a row loads that sale's full detail.
  protected readonly detailVisible = signal(false);
  protected readonly selectedSaleId = signal<string | null>(null);

  protected readonly typeOptions: { label: string; value: SaleType | null }[] = [
    { label: 'Ventas y devoluciones', value: null },
    { label: 'Solo ventas', value: 'Sale' },
    { label: 'Solo devoluciones', value: 'Return' },
  ];

  protected readonly brandOptions = computed(() => [
    { label: 'Todas las marcas', value: null },
    ...this.brands
      .items()
      .filter((b: BrandResponse) => b.status === 'Active')
      .map((b: BrandResponse) => ({ label: b.name, value: b.id as string | null })),
  ]);

  protected readonly hasAnyFilter = computed(
    () =>
      this.searchTerm().trim().length > 0 ||
      this.saleType() !== null ||
      this.brandId() !== null ||
      this.startDate().length > 0 ||
      this.endDate().length > 0,
  );

  // Debounced view of the search box so typing doesn't spam the backend. Drives
  // the same effect as the other filters below.
  private readonly debouncedSearch = toSignal(
    toObservable(this.searchTerm).pipe(
      debounceTime(300),
      map((term) => term.trim()),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  private readonly fetchTrigger$ = new Subject<void>();

  constructor() {
    this.fetchTrigger$
      .pipe(
        switchMap(() => this.sales.search(this.currentParams()).pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Initial load + refetch whenever any filter changes. Reads every filter
    // signal (incl. the debounced search) so the effect re-runs on any change;
    // page is reset to 1 inside untracked() so it never re-triggers itself.
    effect(() => {
      this.debouncedSearch();
      this.saleType();
      this.brandId();
      this.startDate();
      this.endDate();
      untracked(() => {
        this.page.set(1);
        this.fetchTrigger$.next();
      });
    });
  }

  private currentParams(): SaleSearchParams {
    return {
      searchTerm: this.debouncedSearch() || undefined,
      saleType: this.saleType() ?? undefined,
      brandId: this.brandId() ?? undefined,
      startDate: this.startDate() || undefined,
      endDate: this.endDate() || undefined,
      page: this.page(),
      pageSize: this.pageSize(),
    };
  }

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const newPageSize = event.rows ?? 10;
    const newPage = Math.floor((event.first ?? 0) / newPageSize) + 1;
    this.pageSize.set(newPageSize);
    this.page.set(newPage);
    this.fetchTrigger$.next();
  }

  protected openDetail(row: SaleSearchResponse): void {
    this.selectedSaleId.set(row.id);
    this.detailVisible.set(true);
  }

  protected onDetailSaleChanged(id: string): void {
    this.saleChanged.emit(id);
  }

  protected onDetailReturnRequested(id: string): void {
    this.detailVisible.set(false);
    this.returnRequested.emit(id);
  }

  protected clearSearchTerm(): void {
    this.searchTerm.set('');
  }

  protected clearFilters(): void {
    this.searchTerm.set('');
    this.saleType.set(null);
    this.brandId.set(null);
    this.startDate.set('');
    this.endDate.set('');
    // Guarantees an immediate refetch even when only the (debounced) search was
    // active and the other filter signals don't actually change value.
    this.page.set(1);
    this.fetchTrigger$.next();
  }

  protected fullDate(iso: string): string {
    return formatShortDate(iso);
  }

  protected dayLabel(iso: string): 'Hoy' | 'Ayer' | null {
    return relativeDayLabel(iso);
  }

  protected formatTime(iso: string): string {
    return new Intl.DateTimeFormat('es-UY', {
      timeZone: URUGUAY_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(parseBackendUtcDate(iso));
  }

  protected paymentIcon(method: PaymentMethod): LucideIconData {
    return paymentMethodIcon(method);
  }

  protected paymentLabel(method: PaymentMethod): string {
    return paymentMethodLabel(method);
  }

  protected cardBrand(brand: CardBrand): string {
    return cardBrandLabel(brand);
  }

  protected typeStatusLabel(row: SaleSearchResponse): string {
    return saleTypeStatusLabel(row.type, row.status);
  }

  protected typeStatusSeverity(row: SaleSearchResponse): SaleTagSeverity {
    return saleTypeStatusSeverity(row.type, row.status);
  }

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }

  // Re-runs the current query so a just-created sale/return shows up.
  refresh(): void {
    this.fetchTrigger$.next();
  }
}
