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
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';

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

import { BrandResponse } from '../../../admin/settings/marcas/brands.types';
import { BrandsService } from '../../../admin/settings/marcas/brands.service';
import { ProductCategoriesService } from '../product-categories.service';
import { ProductsService } from '../products.service';
import {
  ImmobilizedStockProductResponse,
  KpiFilter,
  ProductResponse,
  ProductSearchParams,
  ProductStockStatus,
} from '../inventory.types';
import { formatCurrencyUYU, formatNumber, parseBackendUtcDate, URUGUAY_TIME_ZONE } from '../inventory.utils';
import { ProductImageComponent } from './product-image.component';
import { StockStatusTagComponent } from './stock-status-tag.component';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <!-- Filter bar -->
      <div class="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <p-iconfield class="flex-1 min-w-0 relative">
          @if (searchTerm().length === 0) {
            <p-inputicon>
              <i-lucide [img]="icons.Search" class="size-4 text-surface-400" />
            </p-inputicon>
          }
          <input
            pInputText
            #stockSearchInput
            type="text"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
            placeholder="Buscar por SKU, nombre, talle, color..."
            [disabled]="kpiFilter() === 'immobilized'"
            class="!pr-10"
            fluid
          />
          @if (searchTerm().trim().length > 0) {
            <button
              type="button"
              class="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-surface-700 dark:hover:text-surface-100"
              aria-label="Limpiar búsqueda"
              pTooltip="Limpiar búsqueda"
              tooltipPosition="bottom"
              [disabled]="kpiFilter() === 'immobilized'"
              (pointerdown)="$event.preventDefault()"
              (click)="clearSearchTerm()"
            >
              <i-lucide [img]="icons.X" class="size-4" />
            </button>
          }
        </p-iconfield>

        @if (showBrandFilter()) {
          <p-select
            [options]="brandOptions()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="brandId()"
            (ngModelChange)="brandId.set($event)"
            placeholder="Todas las Marcas"
            [showClear]="true"
            [disabled]="kpiFilter() === 'immobilized'"
            appendTo="body"
            styleClass="md:w-44"
          />
        }

        <p-select
          [options]="categoryOptions()"
          optionLabel="label"
          optionValue="value"
          [ngModel]="categoryId()"
          (ngModelChange)="categoryId.set($event)"
          placeholder="Categorías"
          [showClear]="true"
          [filter]="true"
          filterBy="label"
          [disabled]="kpiFilter() === 'immobilized'"
          appendTo="body"
          styleClass="md:w-44"
        />

        <button
          pButton
          type="button"
          [severity]="stockStatus() === 'Critical' ? 'warn' : 'secondary'"
          [outlined]="stockStatus() !== 'Critical'"
          [disabled]="kpiFilterControlsList()"
          [pTooltip]="kpiFilterControlsList() ? 'El KPI activo controla este filtro' : ''"
          tooltipPosition="bottom"
          size="small"
          label="Stock Crítico"
          (click)="setStockStatus('Critical')"
        ></button>

        <button
          pButton
          type="button"
          [severity]="stockStatus() === 'OutOfStock' ? 'danger' : 'secondary'"
          [outlined]="stockStatus() !== 'OutOfStock'"
          [disabled]="kpiFilterControlsList()"
          [pTooltip]="kpiFilterControlsList() ? 'El KPI activo controla este filtro' : ''"
          tooltipPosition="bottom"
          size="small"
          label="Agotados"
          (click)="setStockStatus('OutOfStock')"
        ></button>

        <button
          pButton
          type="button"
          [severity]="hasAdvancedFilters() ? 'info' : 'secondary'"
          [outlined]="!hasAdvancedFilters()"
          [disabled]="kpiFilter() === 'immobilized'"
          size="small"
          [label]="hasAdvancedFilters() ? 'Más (' + advancedFiltersCount() + ')' : 'Más'"
          (click)="advancedFiltersPopover.toggle($event)"
        >
          <i-lucide [img]="icons.SlidersHorizontal" class="size-4 mr-1" />
        </button>

        <p-popover #advancedFiltersPopover [style]="{ width: '22rem' }">
          <div class="flex flex-col gap-3">
            <h3 class="text-sm font-semibold text-surface-900 dark:text-surface-0">
              Filtros avanzados
            </h3>

            <div class="flex flex-col gap-1">
              <label
                for="advColor"
                class="text-xs font-medium text-surface-700 dark:text-surface-200"
              >
                Color (coincidencia exacta)
              </label>
              <input
                pInputText
                id="advColor"
                type="text"
                [ngModel]="colorFilter()"
                (ngModelChange)="colorFilter.set($event)"
                placeholder="Ej: Negro"
                fluid
              />
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="advSize"
                class="text-xs font-medium text-surface-700 dark:text-surface-200"
              >
                Talle (coincidencia exacta)
              </label>
              <input
                pInputText
                id="advSize"
                type="text"
                [ngModel]="sizeFilter()"
                (ngModelChange)="sizeFilter.set($event)"
                placeholder="Ej: M"
                fluid
              />
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-xs font-medium text-surface-700 dark:text-surface-200">
                Fecha de ingreso
              </span>
              <button
                pButton
                type="button"
                [severity]="createdAtSort() ? 'info' : 'secondary'"
                [outlined]="createdAtSort() === null"
                size="small"
                [label]="createdAtSortLabel()"
                (click)="toggleCreatedAtSort()"
              >
                @if (createdAtSort() === 'asc') {
                  <i-lucide [img]="icons.CalendarArrowUp" class="size-4 mr-1" />
                } @else {
                  <i-lucide [img]="icons.CalendarArrowDown" class="size-4 mr-1" />
                }
              </button>
            </div>

            @if (canSeeArchived()) {
              <label
                class="flex items-center justify-between gap-2 cursor-pointer select-none border-t border-surface-200 dark:border-surface-700 pt-3"
              >
                <div class="flex flex-col">
                  <span class="text-sm text-surface-700 dark:text-surface-200">
                    Incluir artículos archivados
                  </span>
                  <span class="text-[11px] text-surface-500 dark:text-surface-400">
                    Incluye productos dados de baja.
                  </span>
                </div>
                <p-toggleswitch
                  [ngModel]="includeArchived()"
                  (ngModelChange)="includeArchived.set($event)"
                />
              </label>
            }

            <div
              class="flex justify-between gap-2 pt-2 border-t border-surface-200 dark:border-surface-700"
            >
              <button
                pButton
                type="button"
                severity="secondary"
                [text]="true"
                size="small"
                label="Limpiar filtros avanzados"
                [disabled]="!hasAdvancedFilters()"
                (click)="clearAdvancedFilters()"
              ></button>
              <button
                pButton
                type="button"
                size="small"
                label="Cerrar"
                (click)="advancedFiltersPopover.hide()"
              ></button>
            </div>
          </div>
        </p-popover>
      </div>

      <!-- Table -->
      <div
        class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden"
      >
        <p-table
          [value]="tableItems()"
          [lazy]="true"
          [paginator]="true"
          [rows]="pageSize()"
          [first]="(page() - 1) * pageSize()"
          [totalRecords]="tableTotal()"
          [rowsPerPageOptions]="[12, 24, 48]"
          [loading]="loading()"
          (onLazyLoad)="onLazyLoad($event)"
          dataKey="id"
          styleClass="p-datatable-sm"
          responsiveLayout="scroll"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} artículos"
        >
          <ng-template pTemplate="header">
            <tr>
              <th class="w-20">IMG</th>
              <th class="min-w-32">SKU</th>
              <th class="min-w-56">ARTÍCULO</th>
              <th class="hidden md:table-cell">CATEGORÍA</th>
              <th class="hidden md:table-cell">MARCA</th>
              <th class="hidden lg:table-cell">TALLE/COLOR</th>
              <th class="text-right">PRECIO</th>
              <th class="text-right">STOCK</th>
              @if (kpiFilter() === 'immobilized') {
                <th class="hidden md:table-cell text-right">DÍAS S/VENTAS</th>
                <th class="hidden lg:table-cell">ÚLTIMA VENTA</th>
              }
              <th>ESTADO</th>
              <th class="text-right w-28">ACCIONES</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-row>
            <tr>
              <td>
                <app-product-image
                  [imageUrl]="row.imageUrl"
                  [categoryName]="row.categoryName"
                  [alt]="row.name"
                  size="md"
                />
              </td>
              <td>
                <span class="font-mono text-sm font-medium text-surface-800 dark:text-surface-100">
                  {{ row.sku }}
                </span>
              </td>
              <td>
                <div class="flex flex-col">
                  <span class="font-medium text-surface-900 dark:text-surface-0">
                    {{ row.name }}
                  </span>
                  <span class="text-xs text-surface-500 dark:text-surface-400 md:hidden">
                    {{ row.categoryName }} · {{ row.brandName }}
                  </span>
                </div>
              </td>
              <td class="hidden md:table-cell">
                <span class="text-sm text-surface-600 dark:text-surface-300">
                  {{ row.categoryName ?? '—' }}
                </span>
              </td>
              <td class="hidden md:table-cell">
                <span class="text-sm text-surface-700 dark:text-surface-200">
                  {{ row.brandName ?? '—' }}
                </span>
              </td>
              <td class="hidden lg:table-cell">
                <span class="text-sm text-surface-600 dark:text-surface-300">
                  {{ talleColor(row) }}
                </span>
              </td>
              <td class="text-right">
                <span class="text-sm font-medium text-surface-800 dark:text-surface-100">
                  {{ formatCurrency(row.price) }}
                </span>
              </td>
              <td class="text-right">
                <span
                  class="font-bold"
                  [class.text-red-600]="row.currentStock <= row.minStockAlert && row.currentStock > 0"
                  [class.dark:text-red-300]="row.currentStock <= row.minStockAlert && row.currentStock > 0"
                  [class.text-surface-400]="row.currentStock === 0"
                  [class.text-surface-900]="row.currentStock > row.minStockAlert"
                  [class.dark:text-surface-0]="row.currentStock > row.minStockAlert"
                >
                  {{ formatNumber(row.currentStock) }}
                </span>
              </td>
              @if (kpiFilter() === 'immobilized') {
                <td class="hidden md:table-cell text-right">
                  <span class="text-sm font-medium text-amber-600 dark:text-amber-300">
                    {{ formatNumber(row.daysWithoutSales) }}
                  </span>
                </td>
                <td class="hidden lg:table-cell">
                  <span class="text-xs text-surface-600 dark:text-surface-300">
                    {{ formatLastSale(row.lastSaleAtUtc) }}
                  </span>
                </td>
              }
              <td>
                <app-stock-status-tag
                  [stock]="row.currentStock"
                  [minAlert]="row.minStockAlert"
                />
              </td>
              <td class="text-right">
                <div class="flex items-center justify-end gap-1">
                  @if (canEdit() && !row.immobilized) {
                    <button
                      pButton
                      type="button"
                      severity="secondary"
                      [text]="true"
                      [rounded]="true"
                      pTooltip="Editar artículo"
                      tooltipPosition="top"
                      (click)="editProduct.emit(row)"
                    >
                      <i-lucide [img]="icons.Pencil" class="size-4" />
                    </button>
                  }
                  @if (canArchive() && !row.immobilized && row.isActive) {
                    <button
                      pButton
                      type="button"
                      severity="warn"
                      [text]="true"
                      [rounded]="true"
                      pTooltip="Archivar artículo"
                      tooltipPosition="top"
                      (click)="archiveProduct.emit(row)"
                    >
                      <i-lucide [img]="icons.Archive" class="size-4" />
                    </button>
                  }
                </div>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="10" class="text-center py-10 text-surface-500 dark:text-surface-400">
                @if (hasAnyFilter()) {
                  No se encontraron artículos para los filtros aplicados.
                } @else {
                  Todavía no hay artículos cargados. Agregá uno con
                  <strong>+ Nuevo Artículo</strong>.
                }
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>
  `,
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

  constructor() {
    // Refetch when debounced search term changes.
    this.debouncedSearchTerm$.subscribe(() => {
      this.page.set(1);
      this.fetch();
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
        this.fetch();
      });
    });
  }

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const newPageSize = event.rows ?? 12;
    const newPage = Math.floor((event.first ?? 0) / newPageSize) + 1;
    this.pageSize.set(newPageSize);
    this.page.set(newPage);
    this.fetch();
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
    this.fetch();
  }

  private fetch(): void {
    const filter = this.kpiFilter();
    const scope = this.brandScope();

    if (filter === 'immobilized') {
      // The immobilized endpoint has its own (smaller) param set: it doesn't
      // accept search/category/status filters. The other on-screen filters
      // are visually disabled while this KPI is active.
      this.products
        .searchImmobilized({
          days: 60,
          page: this.page(),
          pageSize: this.pageSize(),
          brandId: scope ?? this.brandId() ?? undefined,
        })
        .subscribe({ error: () => {} });
      return;
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
    this.products.search(params).subscribe({
      error: () => {
        // error.interceptor already shows a toast
      },
    });
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
