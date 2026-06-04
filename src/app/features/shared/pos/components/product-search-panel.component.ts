import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, catchError, debounceTime, distinctUntilChanged, skip, switchMap, tap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { LucideAngularModule, Plus, Search, X } from 'lucide-angular';

import { BrandsService } from '../../../../core/brands/brands.service';
import { BrandResponse } from '../../../../core/brands/brands.types';
import { ProductCategoriesService } from '../../inventory/product-categories.service';
import { ProductsService } from '../../inventory/products.service';
import { ProductResponse } from '../../inventory/inventory.types';
import { formatCurrencyUYU, formatNumber } from '../../inventory/inventory.utils';
import { ProductImageComponent } from '../../inventory/components/product-image.component';
import { PosCartStore } from '../pos-cart.store';

@Component({
  selector: 'app-pos-product-search-panel',
  imports: [
    FormsModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TooltipModule,
    LucideAngularModule,
    ProductImageComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-search-panel.component.html',
})
export class ProductSearchPanelComponent {
  private readonly products = inject(ProductsService);
  private readonly brands = inject(BrandsService);
  private readonly categories = inject(ProductCategoriesService);
  protected readonly cart = inject(PosCartStore);

  protected readonly icons = { Search, Plus, X };

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly searchTerm = signal('');
  protected readonly brandId = signal<string | null>(null);
  protected readonly categoryId = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(8);

  // Local result state — uses ProductsService.searchOnce so the Inventario
  // list view (which uses ProductsService.search) is never disturbed.
  protected readonly results = signal<ProductResponse[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly loading = signal(false);

  // Active brands power the chip row ("Todas las Marcas" + one per brand).
  protected readonly activeBrands = computed(() =>
    this.brands.items().filter((b: BrandResponse) => b.status === 'Active'),
  );

  protected readonly categoryOptions = computed(() =>
    this.categories.items().map((c) => ({ label: c.name, value: c.id })),
  );

  protected readonly hasFilters = computed(
    () =>
      this.searchTerm().trim().length > 0 || this.brandId() !== null || this.categoryId() !== null,
  );

  private readonly debouncedSearchTerm$ = toObservable(this.searchTerm).pipe(
    skip(1),
    debounceTime(300),
    distinctUntilChanged(),
  );

  private readonly fetchTrigger$ = new Subject<void>();

  constructor() {
    this.fetchTrigger$
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          return this.products
            .searchOnce({
              searchTerm: this.searchTerm() || undefined,
              brandId: this.brandId() ?? undefined,
              categoryId: this.categoryId() ?? undefined,
              page: this.page(),
              pageSize: this.pageSize(),
            })
            .pipe(
              tap({
                next: (res) => {
                  this.results.set(res.items);
                  this.totalCount.set(res.totalCount);
                  this.loading.set(false);
                },
                error: () => this.loading.set(false),
              }),
              catchError(() => EMPTY),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.debouncedSearchTerm$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.page.set(1);
      this.fetchTrigger$.next();
    });

    // Initial load + refetch on filter changes.
    effect(() => {
      this.brandId();
      this.categoryId();
      untracked(() => {
        this.page.set(1);
        this.fetchTrigger$.next();
      });
    });
  }

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const newPageSize = event.rows ?? 8;
    const newPage = Math.floor((event.first ?? 0) / newPageSize) + 1;
    this.pageSize.set(newPageSize);
    this.page.set(newPage);
    this.fetchTrigger$.next();
  }

  protected selectBrand(brandId: string | null): void {
    this.brandId.set(brandId);
  }

  // Brand filter chips are plain buttons styled with theme tokens instead of
  // PrimeNG's `pButton` + `[outlined]` toggle: the ButtonDirective fails to
  // remove `p-button-outlined` when `outlined` flips true→false, leaving the
  // freshly-selected chip looking outlined instead of solid. Controlling the
  // classes here keeps the active chip clearly filled on every selection.
  protected chipClasses(active: boolean): string {
    const base =
      'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
    return active
      ? `${base} bg-primary text-primary-contrast border border-primary shadow-sm`
      : `${base} bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-300 border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-surface-800 dark:hover:text-surface-100`;
  }

  protected clearSearchTerm(): void {
    this.searchTerm.set('');
    queueMicrotask(() => this.searchInput()?.nativeElement.focus());
  }

  protected isLowStock(p: ProductResponse): boolean {
    return p.currentStock > 0 && p.currentStock <= p.minStockAlert;
  }

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }

  protected formatNumber(value: number): string {
    return formatNumber(value);
  }

  // Re-runs the active search so freshly-decremented stock shows after a sale.
  refresh(): void {
    this.fetchTrigger$.next();
  }
}
