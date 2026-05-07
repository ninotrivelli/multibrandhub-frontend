import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map, of, skip, switchMap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Search, X, FilterX, LucideAngularModule } from 'lucide-angular';

import { BrandsService } from '../../../admin/settings/marcas/brands.service';
import { BrandResponse } from '../../../admin/settings/marcas/brands.types';
import { ProductsService } from '../products.service';
import { StockMovementsService } from '../stock-movements.service';
import {
  MovementType,
  ProductResponse,
  StockMovementResponse,
  StockMovementSearchParams,
} from '../inventory.types';
import { formatMovementDate, movementTypeLabel, movementTypeSeverity } from '../inventory.utils';
import { ProductImageComponent } from './product-image.component';

interface TypeOption {
  label: string;
  value: MovementType;
}

@Component({
  selector: 'app-movements-tab',
  imports: [
    FormsModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    TooltipModule,
    LucideAngularModule,
    ProductImageComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <!-- Filters -->
      <div
        class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 flex flex-col gap-3"
      >
        <!-- Product typeahead (always visible, even with one selected) -->
        <div class="flex flex-col gap-1.5 relative">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-200">
            Producto
          </label>

          @if (selectedProduct(); as p) {
            <div
              class="rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 p-2 flex items-center justify-between gap-2"
            >
              <div class="flex items-center gap-2 min-w-0">
                <app-product-image
                  [imageUrl]="p.imageUrl"
                  [categoryName]="p.categoryName"
                  [alt]="p.name"
                  size="sm"
                />
                <div class="flex flex-col min-w-0">
                  <span class="font-medium text-sm text-surface-900 dark:text-surface-0 truncate">
                    {{ p.name }}
                  </span>
                  <span class="text-xs text-surface-500 dark:text-surface-400 truncate">
                    {{ p.sku }} · {{ p.brandName }} · Stock: {{ p.currentStock }}
                  </span>
                </div>
              </div>
              <button
                pButton
                type="button"
                severity="secondary"
                [text]="true"
                size="small"
                pTooltip="Quitar filtro de producto"
                (click)="clearProduct()"
              >
                <i-lucide [img]="icons.X" class="size-4" />
              </button>
            </div>
          }

          <p-iconfield>
            @if (searchTerm().length === 0) {
              <p-inputicon>
                <i-lucide [img]="icons.Search" class="size-4 text-surface-400" />
              </p-inputicon>
            }
            <input
              pInputText
              type="text"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              [placeholder]="
                selectedProduct() ? 'Buscar otro producto...' : 'Buscar por SKU o nombre...'
              "
              fluid
            />
          </p-iconfield>

          @if (searchTerm().trim().length > 0) {
            <div
              class="rounded-lg border border-surface-200 dark:border-surface-700 max-h-72 overflow-y-auto divide-y divide-surface-200 dark:divide-surface-700 bg-surface-0 dark:bg-surface-800"
            >
              @if (searching()) {
                <div class="text-sm text-surface-500 dark:text-surface-400 px-3 py-3">
                  Buscando...
                </div>
              } @else if (searchResults().length === 0) {
                <div class="text-sm text-surface-500 dark:text-surface-400 px-3 py-3">
                  No se encontraron artículos.
                </div>
              } @else {
                @for (p of searchResults(); track p.id) {
                  <button
                    type="button"
                    class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-100 dark:hover:bg-surface-900 transition-colors"
                    (click)="selectProduct(p)"
                  >
                    <app-product-image
                      [imageUrl]="p.imageUrl"
                      [categoryName]="p.categoryName"
                      size="sm"
                    />
                    <div class="flex flex-col min-w-0 flex-1">
                      <span
                        class="font-medium text-sm text-surface-900 dark:text-surface-0 truncate"
                      >
                        {{ p.name }}
                      </span>
                      <span class="text-xs text-surface-500 dark:text-surface-400 truncate">
                        {{ p.sku }} · {{ p.brandName }}
                      </span>
                    </div>
                    <span
                      class="text-xs text-surface-500 dark:text-surface-400 whitespace-nowrap shrink-0"
                    >
                      Stock: {{ p.currentStock }}
                    </span>
                  </button>
                }
              }
            </div>
          }
        </div>

        <!-- Type / Brand / Date range -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-surface-600 dark:text-surface-300">Tipo</label>
            <p-select
              [options]="typeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Todos los tipos"
              [showClear]="true"
              [ngModel]="selectedType()"
              (ngModelChange)="selectedType.set($event)"
              appendTo="body"
              fluid
            />
          </div>

          @if (showBrandFilter()) {
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-surface-600 dark:text-surface-300">
                Marca
              </label>
              <p-select
                [options]="brandOptions()"
                optionLabel="label"
                optionValue="value"
                placeholder="Todas las marcas"
                [showClear]="true"
                [ngModel]="selectedBrandId()"
                (ngModelChange)="selectedBrandId.set($event)"
                appendTo="body"
                fluid
              />
            </div>
          }

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-surface-600 dark:text-surface-300">
              Desde
            </label>
            <input
              pInputText
              type="date"
              [ngModel]="dateFrom()"
              (ngModelChange)="dateFrom.set($event)"
              fluid
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-surface-600 dark:text-surface-300">
              Hasta
            </label>
            <input
              pInputText
              type="date"
              [ngModel]="dateTo()"
              (ngModelChange)="dateTo.set($event)"
              fluid
            />
          </div>
        </div>

        @if (hasAnyFilter()) {
          <div class="flex justify-end">
            <button
              pButton
              type="button"
              severity="secondary"
              [text]="true"
              size="small"
              label="Limpiar filtros"
              (click)="clearAllFilters()"
            >
              <i-lucide [img]="icons.FilterX" class="size-4 mr-1" />
            </button>
          </div>
        }
      </div>

      <!-- Movements table -->
      <div
        class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden"
      >
        <p-table
          [value]="movements()"
          [lazy]="true"
          [paginator]="true"
          [rows]="pageSize()"
          [first]="(page() - 1) * pageSize()"
          [totalRecords]="totalCount()"
          [rowsPerPageOptions]="[20, 50, 100]"
          [loading]="loading()"
          (onLazyLoad)="onLazyLoad($event)"
          dataKey="id"
          styleClass="p-datatable-sm"
          responsiveLayout="scroll"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} movimientos"
        >
          <ng-template pTemplate="header">
            <tr>
              <th class="min-w-44">FECHA / HORA</th>
              <th class="min-w-56">PRODUCTO</th>
              @if (showBrandFilter()) {
                <th class="hidden md:table-cell min-w-32">MARCA</th>
              }
              <th class="min-w-28">TIPO</th>
              <th class="text-right min-w-24">CANTIDAD</th>
              <th class="hidden lg:table-cell min-w-32">USUARIO</th>
              <th class="hidden xl:table-cell min-w-56">OBSERVACIONES</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-row>
            <tr>
              <td>
                <span class="text-sm text-surface-700 dark:text-surface-200">
                  {{ formatDate(row.date) }}
                </span>
              </td>
              <td>
                <div class="flex flex-col min-w-0">
                  <span class="text-sm font-medium text-surface-900 dark:text-surface-0 truncate">
                    {{ row.productName ?? '—' }}
                  </span>
                  @if (row.brandName) {
                    <span class="text-xs text-surface-500 dark:text-surface-400 truncate md:hidden">
                      {{ row.brandName }}
                    </span>
                  }
                </div>
              </td>
              @if (showBrandFilter()) {
                <td class="hidden md:table-cell">
                  <span class="text-sm text-surface-600 dark:text-surface-300">
                    {{ row.brandName ?? '—' }}
                  </span>
                </td>
              }
              <td>
                <p-tag
                  [value]="typeLabel(row)"
                  [severity]="typeSeverity(row)"
                  styleClass="!text-xs !font-semibold !px-2 !py-0.5"
                />
              </td>
              <td class="text-right">
                <span
                  class="font-bold"
                  [class.text-emerald-600]="row.quantity > 0"
                  [class.dark:text-emerald-300]="row.quantity > 0"
                  [class.text-red-600]="row.quantity < 0"
                  [class.dark:text-red-300]="row.quantity < 0"
                >
                  {{ row.quantity > 0 ? '+' : '' }}{{ row.quantity }}
                </span>
              </td>
              <td class="hidden lg:table-cell">
                <span class="text-sm text-surface-600 dark:text-surface-300">
                  {{ row.userFullName ?? 'Sistema' }}
                </span>
              </td>
              <td class="hidden xl:table-cell">
                <span class="text-sm text-surface-700 dark:text-surface-200">
                  {{ row.observations ?? '—' }}
                </span>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td
                [attr.colspan]="emptyColspan()"
                class="text-center py-10 text-surface-500 dark:text-surface-400"
              >
                @if (hasAnyFilter()) {
                  No se encontraron movimientos para los filtros aplicados.
                } @else {
                  Todavía no hay movimientos registrados.
                }
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>
  `,
})
export class MovementsTabComponent {
  private readonly products = inject(ProductsService);
  private readonly movementsSvc = inject(StockMovementsService);
  private readonly brands = inject(BrandsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly showBrandFilter = input<boolean>(true);
  readonly brandScope = input<string | null>(null);

  protected readonly icons = { Search, X, FilterX };

  // Product picker
  protected readonly searchTerm = signal('');
  protected readonly selectedProduct = signal<ProductResponse | null>(null);
  protected readonly searching = signal(false);

  // Filters
  protected readonly selectedType = signal<MovementType | null>(null);
  protected readonly selectedBrandId = signal<string | null>(null);
  protected readonly dateFrom = signal<string>('');
  protected readonly dateTo = signal<string>('');

  // Pagination
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);

  // List state (sourced from service)
  protected readonly movements = this.movementsSvc.searchItems;
  protected readonly totalCount = this.movementsSvc.searchTotalCount;
  protected readonly loading = this.movementsSvc.searchLoading;

  protected readonly typeOptions: TypeOption[] = [
    { label: 'Ingreso / Re-stock', value: MovementType.StockIn },
    { label: 'Venta', value: MovementType.Sale },
    { label: 'Devolución', value: MovementType.Return },
    { label: 'Ajuste manual', value: MovementType.Adjustment },
    { label: 'Sesión de fotos', value: MovementType.Shooting },
    { label: 'Egreso / Pérdida', value: MovementType.Loss },
  ];

  protected readonly brandOptions = computed(() =>
    this.brands
      .items()
      .filter((b: BrandResponse) => b.status === 'Active')
      .map((b: BrandResponse) => ({ label: b.name, value: b.id })),
  );

  protected readonly hasAnyFilter = computed(
    () =>
      this.selectedProduct() !== null ||
      this.selectedType() !== null ||
      this.selectedBrandId() !== null ||
      this.dateFrom().length > 0 ||
      this.dateTo().length > 0,
  );

  protected readonly emptyColspan = computed(() => (this.showBrandFilter() ? 7 : 6));

  // Live product search for the typeahead (non-mutating).
  private readonly searchResults$ = toObservable(this.searchTerm).pipe(
    debounceTime(250),
    distinctUntilChanged(),
    switchMap((term) => {
      if (!term || term.trim().length < 1) {
        this.searching.set(false);
        return of([] as ProductResponse[]);
      }
      this.searching.set(true);
      return this.products
        .searchOnce({ searchTerm: term, page: 1, pageSize: 8 })
        .pipe(map((res) => res.items));
    }),
  );

  protected readonly searchResults = toSignal(this.searchResults$, { initialValue: [] });

  constructor() {
    // Stop spinner when results land.
    effect(() => {
      this.searchResults();
      untracked(() => this.searching.set(false));
    });

    // Refetch on filter changes (immediate).
    effect(() => {
      this.selectedProduct();
      this.selectedType();
      this.selectedBrandId();
      this.dateFrom();
      this.dateTo();
      this.brandScope();
      untracked(() => {
        this.page.set(1);
        this.fetch();
      });
    });

    // Refetch when the service signals a new movement was created. skip(1)
    // drops the synthetic initial emission so we don't double-fetch on load.
    toObservable(this.movementsSvc.refreshTick)
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetch());
  }

  protected selectProduct(p: ProductResponse): void {
    this.selectedProduct.set(p);
    this.searchTerm.set('');
  }

  protected clearProduct(): void {
    this.selectedProduct.set(null);
  }

  protected clearAllFilters(): void {
    this.selectedProduct.set(null);
    this.selectedType.set(null);
    this.selectedBrandId.set(null);
    this.dateFrom.set('');
    this.dateTo.set('');
    this.searchTerm.set('');
  }

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const newPageSize = event.rows ?? 20;
    const newPage = Math.floor((event.first ?? 0) / newPageSize) + 1;
    if (newPageSize === this.pageSize() && newPage === this.page()) return;
    this.pageSize.set(newPageSize);
    this.page.set(newPage);
    this.fetch();
  }

  protected typeLabel(m: StockMovementResponse): string {
    return movementTypeLabel(m.type);
  }

  protected typeSeverity(
    m: StockMovementResponse,
  ): 'success' | 'danger' | 'info' | 'warn' | 'secondary' {
    return movementTypeSeverity(m.type);
  }

  protected formatDate(iso: string): string {
    return formatMovementDate(iso);
  }

  refresh(): void {
    this.fetch();
  }

  private fetch(): void {
    const params: StockMovementSearchParams = {
      page: this.page(),
      pageSize: this.pageSize(),
    };
    const product = this.selectedProduct();
    if (product) params.productId = product.id;
    const type = this.selectedType();
    if (type) params.type = type;

    // BrandManager scope wins; otherwise apply the user-picked brand filter.
    const scope = this.brandScope();
    if (scope) {
      params.brandId = scope;
    } else if (this.selectedBrandId()) {
      params.brandId = this.selectedBrandId()!;
    }

    if (this.dateFrom()) params.from = this.dateFrom();
    if (this.dateTo()) params.to = this.dateTo();

    this.movementsSvc.search(params).subscribe({
      error: () => {
        // error.interceptor already shows a toast
      },
    });
  }
}
