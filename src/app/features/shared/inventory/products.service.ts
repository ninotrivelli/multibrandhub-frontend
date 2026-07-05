import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, finalize, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SessionStateRegistry } from '../../../core/session/session-state-registry.service';
import {
  CreateProductRequest,
  ImmobilizedStockProductResponse,
  ImmobilizedStockSearchParams,
  PagedResult,
  ProductResponse,
  ProductSearchParams,
  ProductSkuValidationResponse,
  UpdateProductRequest,
} from './inventory.types';

interface KpiCounts {
  total: number;
  critical: number;
  outOfStock: number;
}

export interface ProductImportRowError {
  row: number;
  field: string;
  value: string | null;
  message: string;
}

export interface ProductImportResponse {
  totalRows: number;
  created: number;
  rejected: number;
  errors: ProductImportRowError[];
}

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = inject(SessionStateRegistry);
  private readonly baseUrl = `${environment.apiBaseUrl}/products`;

  private readonly _items = signal<ProductResponse[]>([]);
  private readonly _totalCount = signal(0);
  private readonly _loading = signal(false);
  private readonly _kpiCounts = signal<KpiCounts>({ total: 0, critical: 0, outOfStock: 0 });
  private readonly _kpiLoading = signal(false);
  private readonly _allItems = signal<ProductResponse[]>([]);
  private readonly _allItemsLoading = signal(false);
  private readonly _immobilizedItems = signal<ImmobilizedStockProductResponse[]>([]);
  private readonly _immobilizedTotal = signal(0);
  private readonly _immobilizedCount = signal(0);
  private readonly _immobilizedLoading = signal(false);

  readonly items = this._items.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly hasItems = computed(() => this._items().length > 0);
  readonly kpiCounts = this._kpiCounts.asReadonly();
  readonly kpiLoading = this._kpiLoading.asReadonly();
  readonly allItems = this._allItems.asReadonly();
  readonly allItemsLoading = this._allItemsLoading.asReadonly();
  readonly immobilizedItems = this._immobilizedItems.asReadonly();
  readonly immobilizedTotal = this._immobilizedTotal.asReadonly();
  readonly immobilizedCount = this._immobilizedCount.asReadonly();
  readonly immobilizedLoading = this._immobilizedLoading.asReadonly();

  constructor() {
    this.sessionState.registerResetter(() => this.resetSessionState());
  }

  search(params: ProductSearchParams): Observable<PagedResult<ProductResponse>> {
    const generation = this.sessionState.captureGeneration();
    const httpParams = this.buildSearchParams(params);
    this._loading.set(true);
    return this.http
      .get<PagedResult<ProductResponse>>(`${this.baseUrl}/search`, { params: httpParams })
      .pipe(
        tap({
          next: (res) => {
            if (!this.sessionState.isCurrentGeneration(generation)) return;
            this._items.set(res.items);
            this._totalCount.set(res.totalCount);
            this._loading.set(false);
          },
          error: () => {
            if (this.sessionState.isCurrentGeneration(generation)) this._loading.set(false);
          },
        }),
      );
  }

  // Lookup-only variant. Does NOT touch _items / _totalCount / _loading, so
  // product pickers (movement dialog, movements tab) can query without
  // clobbering the list-view state behind them.
  searchOnce(params: ProductSearchParams): Observable<PagedResult<ProductResponse>> {
    const httpParams = this.buildSearchParams(params);
    return this.http.get<PagedResult<ProductResponse>>(`${this.baseUrl}/search`, {
      params: httpParams,
    });
  }

  // Three lightweight calls (pageSize=1) to get the per-status totalCount.
  // Cheap because the response carries no items beyond the first page.
  loadKpiCounts(brandIdScope?: string): Observable<KpiCounts> {
    const generation = this.sessionState.captureGeneration();
    this._kpiLoading.set(true);
    const baseParams: ProductSearchParams = { pageSize: 1, page: 1 };
    if (brandIdScope) baseParams.brandId = brandIdScope;

    const total$ = this.http.get<PagedResult<ProductResponse>>(`${this.baseUrl}/search`, {
      params: this.buildSearchParams(baseParams),
    });
    const critical$ = this.http.get<PagedResult<ProductResponse>>(`${this.baseUrl}/search`, {
      params: this.buildSearchParams({ ...baseParams, stockStatus: 'Critical' }),
    });
    const outOfStock$ = this.http.get<PagedResult<ProductResponse>>(`${this.baseUrl}/search`, {
      params: this.buildSearchParams({ ...baseParams, stockStatus: 'OutOfStock' }),
    });

    return forkJoin({ total: total$, critical: critical$, outOfStock: outOfStock$ }).pipe(
      map((res) => ({
        total: res.total.totalCount,
        critical: res.critical.totalCount,
        outOfStock: res.outOfStock.totalCount,
      })),
      tap((counts) => {
        if (this.sessionState.isCurrentGeneration(generation)) this._kpiCounts.set(counts);
      }),
      finalize(() => {
        if (this.sessionState.isCurrentGeneration(generation)) this._kpiLoading.set(false);
      }),
    );
  }

  // Used to compute aggregate KPIs (total units, inventory value). Backend
  // caps pageSize at 100, so we fetch the first page and then any remaining
  // pages in parallel via forkJoin. For a small store this is one request;
  // for ~500 products it's 5. If the catalog ever grows large enough to make
  // this expensive, the right move is a dedicated stats endpoint server-side.
  loadAll(brandIdScope?: string): Observable<ProductResponse[]> {
    const generation = this.sessionState.captureGeneration();
    this._allItemsLoading.set(true);
    const PAGE_SIZE = 100;
    const firstPage$ = this.http.get<PagedResult<ProductResponse>>(`${this.baseUrl}/search`, {
      params: this.buildSearchParams({ pageSize: PAGE_SIZE, page: 1, brandId: brandIdScope }),
    });

    return firstPage$.pipe(
      switchMap((first) => {
        const totalPages = Math.max(1, Math.ceil(first.totalCount / PAGE_SIZE));
        if (totalPages <= 1) return of(first.items);

        const remainingPages$ = Array.from({ length: totalPages - 1 }, (_, i) =>
          this.http.get<PagedResult<ProductResponse>>(`${this.baseUrl}/search`, {
            params: this.buildSearchParams({
              pageSize: PAGE_SIZE,
              page: i + 2,
              brandId: brandIdScope,
            }),
          }),
        );
        return forkJoin(remainingPages$).pipe(
          map((rest) => [...first.items, ...rest.flatMap((r) => r.items)]),
        );
      }),
      tap((items) => {
        if (this.sessionState.isCurrentGeneration(generation)) this._allItems.set(items);
      }),
      finalize(() => {
        if (this.sessionState.isCurrentGeneration(generation)) this._allItemsLoading.set(false);
      }),
    );
  }

  getById(id: string): Observable<ProductResponse> {
    return this.http.get<ProductResponse>(`${this.baseUrl}/${id}`);
  }

  validateSku(sku: string): Observable<ProductSkuValidationResponse> {
    const params = new HttpParams().set('sku', sku);
    return this.http.get<ProductSkuValidationResponse>(`${this.baseUrl}/sku-validation`, {
      params,
    });
  }

  create(req: CreateProductRequest): Observable<ProductResponse> {
    const generation = this.sessionState.captureGeneration();
    return this.http.post<ProductResponse>(this.baseUrl, req).pipe(
      tap((created) => {
        if (!this.sessionState.isCurrentGeneration(generation)) return;
        this._items.update((curr) => [created, ...curr]);
        this._totalCount.update((c) => c + 1);
      }),
    );
  }

  update(id: string, req: UpdateProductRequest): Observable<ProductResponse> {
    const generation = this.sessionState.captureGeneration();
    return this.http.put<ProductResponse>(`${this.baseUrl}/${id}`, req).pipe(
      tap((updated) => {
        if (this.sessionState.isCurrentGeneration(generation)) this.replaceProduct(updated);
      }),
    );
  }

  uploadImage(productId: string, file: File): Observable<ProductResponse> {
    const generation = this.sessionState.captureGeneration();
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ProductResponse>(`${this.baseUrl}/${productId}/image`, fd).pipe(
      tap((updated) => {
        if (this.sessionState.isCurrentGeneration(generation)) this.replaceProduct(updated);
      }),
    );
  }

  clearImage(productId: string): Observable<ProductResponse> {
    const generation = this.sessionState.captureGeneration();
    return this.http.delete<ProductResponse>(`${this.baseUrl}/${productId}/image`).pipe(
      tap((updated) => {
        if (this.sessionState.isCurrentGeneration(generation)) this.replaceProduct(updated);
      }),
    );
  }

  archive(id: string): Observable<ProductResponse> {
    const generation = this.sessionState.captureGeneration();
    return this.http.patch<ProductResponse>(`${this.baseUrl}/${id}/archive`, {}).pipe(
      tap((archived) => {
        if (!this.sessionState.isCurrentGeneration(generation)) return;
        this._items.update((curr) =>
          curr.some((p) => p.id === id && p.isActive)
            ? curr.filter((p) => p.id !== id)
            : curr.map((p) => (p.id === id ? archived : p)),
        );
        this._totalCount.update((c) => Math.max(0, c - 1));
        this._allItems.update((curr) => curr.filter((p) => p.id !== id));
      }),
    );
  }

  reactivate(id: string): Observable<ProductResponse> {
    const generation = this.sessionState.captureGeneration();
    return this.http.patch<ProductResponse>(`${this.baseUrl}/${id}/reactivate`, {}).pipe(
      tap((reactivated) => {
        if (!this.sessionState.isCurrentGeneration(generation)) return;
        this._items.update((curr) => curr.map((p) => (p.id === id ? reactivated : p)));
        this._allItems.update((curr) => curr.map((p) => (p.id === id ? reactivated : p)));
      }),
    );
  }

  delete(id: string): Observable<void> {
    const generation = this.sessionState.captureGeneration();
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        if (!this.sessionState.isCurrentGeneration(generation)) return;
        this._items.update((curr) => curr.filter((p) => p.id !== id));
        this._totalCount.update((c) => Math.max(0, c - 1));
      }),
    );
  }

  // Returns the Excel template the user fills out before importing. Backend
  // serves an .xlsx blob with Spanish headers and a single example row.
  downloadImportTemplate(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/import-template`, { responseType: 'blob' });
  }

  // Bulk-creates products from a .csv/.xls/.xlsx. Backend is all-or-nothing:
  // on any row error nothing is created and the response carries `errors[]`
  // with row-level diagnostics. The shell calls `loadAll` + `loadKpiCounts` +
  // `loadImmobilizedCount` afterwards to refresh aggregates.
  importProducts(brandId: string, file: File): Observable<ProductImportResponse> {
    const fd = new FormData();
    fd.append('brandId', brandId);
    fd.append('file', file);
    return this.http.post<ProductImportResponse>(`${this.baseUrl}/import`, fd);
  }

  // KPI count for the "Stock Inmovilizado" card. Cheap call (pageSize=1).
  loadImmobilizedCount(brandIdScope?: string, days = 60): Observable<number> {
    const generation = this.sessionState.captureGeneration();
    this._immobilizedLoading.set(true);
    let params = new HttpParams().set('days', days).set('page', 1).set('pageSize', 1);
    if (brandIdScope) params = params.set('brandId', brandIdScope);
    return this.http
      .get<PagedResult<ImmobilizedStockProductResponse>>(`${this.baseUrl}/immobilized-stock`, {
        params,
      })
      .pipe(
        tap((res) => {
          if (this.sessionState.isCurrentGeneration(generation)) {
            this._immobilizedCount.set(res.totalCount);
          }
        }),
        map((res) => res.totalCount),
        finalize(() => {
          if (this.sessionState.isCurrentGeneration(generation)) {
            this._immobilizedLoading.set(false);
          }
        }),
      );
  }

  // Paginated immobilized-stock list. Uses the shared `_loading` signal so the
  // <p-table> shows the same spinner as the regular search.
  searchImmobilized(
    params: ImmobilizedStockSearchParams,
  ): Observable<PagedResult<ImmobilizedStockProductResponse>> {
    const generation = this.sessionState.captureGeneration();
    let httpParams = new HttpParams()
      .set('days', params.days)
      .set('page', params.page ?? 1)
      .set('pageSize', params.pageSize ?? 12);
    if (params.brandId) httpParams = httpParams.set('brandId', params.brandId);
    this._loading.set(true);
    return this.http
      .get<PagedResult<ImmobilizedStockProductResponse>>(`${this.baseUrl}/immobilized-stock`, {
        params: httpParams,
      })
      .pipe(
        tap({
          next: (res) => {
            if (!this.sessionState.isCurrentGeneration(generation)) return;
            this._immobilizedItems.set(res.items);
            this._immobilizedTotal.set(res.totalCount);
            this._loading.set(false);
          },
          error: () => {
            if (this.sessionState.isCurrentGeneration(generation)) this._loading.set(false);
          },
        }),
      );
  }

  // Bumps the product's currentStock locally after a successful movement,
  // mirroring the backend's recompute. Avoids an extra fetch.
  applyStockDelta(productId: string, delta: number): void {
    this._items.update((curr) =>
      curr.map((p) => (p.id === productId ? { ...p, currentStock: p.currentStock + delta } : p)),
    );
    this._allItems.update((curr) =>
      curr.map((p) => (p.id === productId ? { ...p, currentStock: p.currentStock + delta } : p)),
    );
  }

  private replaceProduct(updated: ProductResponse): void {
    this._items.update((curr) => curr.map((p) => (p.id === updated.id ? updated : p)));
    this._allItems.update((curr) => curr.map((p) => (p.id === updated.id ? updated : p)));
  }

  private buildSearchParams(params: ProductSearchParams): HttpParams {
    let p = new HttpParams();
    if (params.searchTerm && params.searchTerm.trim().length > 0) {
      p = p.set('searchTerm', params.searchTerm.trim());
    }
    if (params.brandId) p = p.set('brandId', params.brandId);
    if (params.categoryId) p = p.set('categoryId', params.categoryId);
    if (params.color && params.color.trim().length > 0) p = p.set('color', params.color.trim());
    if (params.size && params.size.trim().length > 0) p = p.set('size', params.size.trim());
    if (params.stockStatuses && params.stockStatuses.length > 0) {
      // Backend reads it as a list — repeated query string keys.
      for (const s of params.stockStatuses) p = p.append('stockStatuses', s);
    } else if (params.stockStatus) {
      p = p.set('stockStatus', params.stockStatus);
    }
    if (params.onlyInStock) p = p.set('onlyInStock', true);
    if (params.includeInactive) p = p.set('includeInactive', true);
    if (params.sortBy) p = p.set('sortBy', params.sortBy);
    if (params.sortDirection) p = p.set('sortDirection', params.sortDirection);
    p = p.set('page', params.page ?? 1);
    p = p.set('pageSize', params.pageSize ?? 12);
    return p;
  }

  private resetSessionState(): void {
    this._items.set([]);
    this._totalCount.set(0);
    this._loading.set(false);
    this._kpiCounts.set({ total: 0, critical: 0, outOfStock: 0 });
    this._kpiLoading.set(false);
    this._allItems.set([]);
    this._allItemsLoading.set(false);
    this._immobilizedItems.set([]);
    this._immobilizedTotal.set(0);
    this._immobilizedCount.set(0);
    this._immobilizedLoading.set(false);
  }
}
