import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  skip,
  switchMap,
} from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { PopoverModule } from 'primeng/popover';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import {
  Archive,
  CalendarArrowDown,
  CalendarArrowUp,
  Pencil,
  Search,
  SlidersHorizontal,
  X,
  LucideAngularModule,
} from 'lucide-angular';

import { BrandResponse } from '../../../../core/brands/brands.types';
import { BrandsService } from '../../../../core/brands/brands.service';
import { ProductCategoriesService } from '../product-categories.service';
import { ProductsService } from '../products.service';
import {
  ImmobilizedStockProductResponse,
  KpiFilter,
  ProductResponse,
  ProductSearchParams,
  ProductStockStatus,
} from '../inventory.types';
import {
  formatCurrencyUYU,
  formatNumber,
  parseBackendUtcDate,
  URUGUAY_TIME_ZONE,
} from '../inventory.utils';
import { ProductImageComponent } from './product-image.component';
import { StockStatusTagComponent } from './stock-status-tag.component';
import { BrandChipComponent } from '../../../../shared/components/brand-chip/brand-chip.component';

// Row in the table can come from either the regular search (ProductResponse)
// or the immobilized-stock search (ImmobilizedStockProductResponse). Common
// columns rely on the intersection; immobilized-only columns are guarded by
// the `kpiFilter` signal.
type TableRow =
  | (ProductResponse & { immobilized?: false })
  | (ImmobilizedStockProductResponse & { immobilized: true });

@Component({
  selector: 'app-stock-search-tab',
  imports: [
    FormsModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    PopoverModule,
    SelectModule,
    SkeletonModule,
    TableModule,
    ToggleSwitchModule,
    TooltipModule,
    LucideAngularModule,
    ProductImageComponent,
    StockStatusTagComponent,
    BrandChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stock-search-tab.component.html',
})
export class StockSearchTabComponent {
  private readonly products = inject(ProductsService);
  private readonly brands = inject(BrandsService);
  private readonly categories = inject(ProductCategoriesService);

  readonly canEdit = input<boolean>(false);
  readonly canArchive = input<boolean>(false);
  readonly showBrandFilter = input<boolean>(true);
  readonly canSeeArchived = input<boolean>(false);
  // When set, scopes the search by brand server-side (BrandManager case).
  readonly brandScope = input<string | null>(null);
  // Drives which list backend endpoint we hit:
  //  - 'all'         → /products/search
  //  - 'immobilized' → /products/immobilized-stock?days=60
  //  - 'alerts'      → /products/search?stockStatuses=Critical&stockStatuses=OutOfStock
  readonly kpiFilter = input<KpiFilter>('all');

  readonly editProduct = output<ProductResponse>();
  readonly archiveProduct = output<ProductResponse>();

  private readonly stockSearchInput = viewChild<ElementRef<HTMLInputElement>>('stockSearchInput');

  protected readonly icons = {
    Search,
    Pencil,
    Archive,
    SlidersHorizontal,
    CalendarArrowDown,
    CalendarArrowUp,
    X,
  };

  protected readonly items = this.products.items;
  protected readonly totalCount = this.products.totalCount;
  protected readonly loading = this.products.loading;

  // Immobilized data lives in its own slot in ProductsService — separate
  // signal so a regular search doesn't clobber it (and vice versa).
  protected readonly immobilizedItems = this.products.immobilizedItems;
  protected readonly immobilizedTotal = this.products.immobilizedTotal;

  protected readonly tableItems = computed<TableRow[]>(() => {
    if (this.kpiFilter() === 'immobilized') {
      return this.immobilizedItems().map((p) => ({ ...p, immobilized: true as const }));
    }
    return this.items().map((p) => ({ ...p, immobilized: false as const }));
  });

  protected readonly tableTotal = computed(() =>
    this.kpiFilter() === 'immobilized' ? this.immobilizedTotal() : this.totalCount(),
  );

  protected readonly kpiFilterControlsList = computed(() => this.kpiFilter() !== 'all');

  // Filter state
  protected readonly searchTerm = signal('');
  protected readonly brandId = signal<string | null>(null);
  protected readonly categoryId = signal<string | null>(null);
  protected readonly stockStatus = signal<ProductStockStatus | null>(null);
  protected readonly colorFilter = signal('');
  protected readonly sizeFilter = signal('');
  protected readonly includeArchived = signal(false);
  protected readonly createdAtSort = signal<'asc' | 'desc' | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(12);

  // Debounced version of searchTerm to avoid hammering the backend.
  // skip(1) drops the synthetic emission that toObservable produces for the
  // signal's current value at subscription time — otherwise we'd fetch twice
  // on initial paint (once from the effect below, once from this stream).
  private readonly debouncedSearchTerm$ = toObservable(this.searchTerm).pipe(
    skip(1),
    debounceTime(300),
    distinctUntilChanged(),
  );

  protected readonly brandOptions = computed(() =>
    this.brands
      .items()
      .filter((b: BrandResponse) => b.status === 'Active')
      .map((b: BrandResponse) => ({ label: b.name, value: b.id })),
  );

  protected readonly categoryOptions = computed(() =>
    this.categories.items().map((c) => ({ label: c.name, value: c.id })),
  );

  protected readonly hasAnyFilter = computed(
    () =>
      this.searchTerm().trim().length > 0 ||
      this.brandId() !== null ||
      this.categoryId() !== null ||
      this.stockStatus() !== null ||
      this.hasAdvancedFilters(),
  );

  protected readonly advancedFiltersCount = computed(() => {
    let n = 0;
    if (this.colorFilter().trim().length > 0) n++;
    if (this.sizeFilter().trim().length > 0) n++;
    if (this.includeArchived()) n++;
    if (this.createdAtSort() !== null) n++;
    return n;
  });

  protected readonly hasAdvancedFilters = computed(() => this.advancedFiltersCount() > 0);

  protected readonly createdAtSortLabel = computed(() =>
    this.createdAtSort() === null
      ? 'Ordenar por ingreso'
      : this.createdAtSort() === 'asc'
        ? 'Más viejos primero'
        : 'Más nuevos primero',
  );

  // All fetches funnel through here so switchMap can cancel an in-flight
  // request when a newer trigger arrives. Without this, a slow earlier
  // response could land after a faster newer one and overwrite the table
  // via the tap() inside ProductsService.search().
  private readonly fetchTrigger$ = new Subject<void>();

  constructor() {
    this.fetchTrigger$
      .pipe(
        switchMap(() => this.buildRequest()),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Refetch when debounced search term changes.
    this.debouncedSearchTerm$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.page.set(1);
      this.fetchTrigger$.next();
    });

    // Refetch on filter changes (immediate, not debounced).
    effect(() => {
      this.brandId();
      this.categoryId();
      this.stockStatus();
      this.brandScope();
      this.colorFilter();
      this.sizeFilter();
      this.includeArchived();
      this.createdAtSort();
      this.kpiFilter();
      untracked(() => {
        this.page.set(1);
        this.fetchTrigger$.next();
      });
    });
  }

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const newPageSize = event.rows ?? 12;
    const newPage = Math.floor((event.first ?? 0) / newPageSize) + 1;
    this.pageSize.set(newPageSize);
    this.page.set(newPage);
    this.fetchTrigger$.next();
  }

  // Stock-status filter buttons are mutually exclusive: clicking the active
  // one clears the filter; clicking the other replaces it.
  protected setStockStatus(target: ProductStockStatus): void {
    this.stockStatus.update((curr) => (curr === target ? null : target));
  }

  protected clearAdvancedFilters(): void {
    this.colorFilter.set('');
    this.sizeFilter.set('');
    this.includeArchived.set(false);
    this.createdAtSort.set(null);
  }

  protected toggleCreatedAtSort(): void {
    this.createdAtSort.update((current) => (current === 'desc' ? 'asc' : 'desc'));
  }

  protected clearSearchTerm(): void {
    this.searchTerm.set('');
    queueMicrotask(() => this.stockSearchInput()?.nativeElement.focus());
  }

  protected talleColor(p: ProductResponse): string {
    const parts: string[] = [];
    if (p.size) parts.push(p.size);
    if (p.color) parts.push(p.color);
    return parts.length > 0 ? parts.join(' · ') : '—';
  }

  protected formatCurrency(v: number): string {
    return formatCurrencyUYU(v);
  }

  protected formatNumber(v: number): string {
    return formatNumber(v);
  }

  refresh(): void {
    this.fetchTrigger$.next();
  }

  // Returns the cold Observable for the active filter set. The outer
  // switchMap on fetchTrigger$ owns the subscription, so we don't call
  // .subscribe() here. catchError → EMPTY keeps the upstream Subject alive
  // after a failed request (error.interceptor still surfaces the toast).
  private buildRequest(): Observable<unknown> {
    const filter = this.kpiFilter();
    const scope = this.brandScope();

    if (filter === 'immobilized') {
      // The immobilized endpoint has its own (smaller) param set: it doesn't
      // accept search/category/status filters. The other on-screen filters
      // are visually disabled while this KPI is active.
      return this.products
        .searchImmobilized({
          days: 60,
          page: this.page(),
          pageSize: this.pageSize(),
          brandId: scope ?? this.brandId() ?? undefined,
        })
        .pipe(catchError(() => EMPTY));
    }

    const params: ProductSearchParams = {
      page: this.page(),
      pageSize: this.pageSize(),
      searchTerm: this.searchTerm() || undefined,
      categoryId: this.categoryId() ?? undefined,
      color: this.colorFilter().trim() || undefined,
      size: this.sizeFilter().trim() || undefined,
      // includeInactive is gated server-side to Admin/SuperAdmin/Seller; we
      // hide the toggle from BrandManager, but also belt-and-braces it here.
      includeInactive: this.canSeeArchived() && this.includeArchived() ? true : undefined,
    };

    const createdAtSort = this.createdAtSort();
    if (createdAtSort) {
      params.sortBy = 'createdAt';
      params.sortDirection = createdAtSort;
    }

    if (filter === 'alerts') {
      // KPI overrides the per-button stockStatus filter while it's active.
      params.stockStatuses = ['Critical', 'OutOfStock'];
    } else if (this.stockStatus()) {
      params.stockStatus = this.stockStatus()!;
    }

    if (scope) {
      // Server-side will also enforce this for BrandManager via JWT, but we
      // pass it explicitly so non-scoped roles get the same effect.
      params.brandId = scope;
    } else if (this.brandId()) {
      params.brandId = this.brandId()!;
    }
    return this.products.search(params).pipe(catchError(() => EMPTY));
  }

  protected formatLastSale(iso: string | null): string {
    if (!iso) return 'Nunca';
    const date = parseBackendUtcDate(iso);
    return new Intl.DateTimeFormat('es-UY', {
      timeZone: URUGUAY_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }
}
