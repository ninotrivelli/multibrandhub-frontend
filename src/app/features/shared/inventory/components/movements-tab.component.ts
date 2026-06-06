import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
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

import { BrandsService } from '../../../../core/brands/brands.service';
import { BrandResponse } from '../../../../core/brands/brands.types';
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
import { BrandChipComponent } from '../../../../shared/components/brand-chip/brand-chip.component';

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
    BrandChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movements-tab.component.html',
})
export class MovementsTabComponent {
  private readonly products = inject(ProductsService);
  private readonly movementsSvc = inject(StockMovementsService);
  private readonly brands = inject(BrandsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly showBrandFilter = input<boolean>(true);
  readonly brandScope = input<string | null>(null);

  private readonly movementSearchInput =
    viewChild<ElementRef<HTMLInputElement>>('movementSearchInput');

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
    { label: 'Egreso / Pérdida', value: MovementType.Loss },
    { label: 'Cambio de precio', value: MovementType.PriceChange },
  ];

  protected readonly movementType = MovementType;

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

  protected clearSearchTerm(): void {
    this.searchTerm.set('');
    queueMicrotask(() => this.movementSearchInput()?.nativeElement.focus());
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
