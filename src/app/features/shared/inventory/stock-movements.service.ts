import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, finalize, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SessionStateRegistry } from '../../../core/session/session-state-registry.service';
import {
  CreateStockMovementRequest,
  PagedResult,
  StockMovementResponse,
  StockMovementSearchParams,
  StockMovementTodaySummary,
} from './inventory.types';
import { formatUruguayDate } from './inventory.utils';
import { ProductsService } from './products.service';

const EMPTY_TODAY_SUMMARY: StockMovementTodaySummary = {
  totalCount: 0,
  inboundUnits: 0,
  outboundUnits: 0,
};

@Injectable({ providedIn: 'root' })
export class StockMovementsService {
  private readonly http = inject(HttpClient);
  private readonly products = inject(ProductsService);
  private readonly sessionState = inject(SessionStateRegistry);
  private readonly baseUrl = `${environment.apiBaseUrl}/stock-movements`;

  // Per-product list state (legacy `loadByProduct` callers).
  private readonly _movements = signal<StockMovementResponse[]>([]);
  private readonly _totalCount = signal(0);
  private readonly _loading = signal(false);
  private readonly _activeProductId = signal<string | null>(null);

  // Cross-product search state used by the Movements (Kardex) tab.
  private readonly _searchItems = signal<StockMovementResponse[]>([]);
  private readonly _searchTotalCount = signal(0);
  private readonly _searchLoading = signal(false);

  // KPI: movement units registered today in Uruguay time.
  private readonly _todaySummary = signal<StockMovementTodaySummary>(EMPTY_TODAY_SUMMARY);
  private readonly _todaySummaryLoading = signal(false);

  // Bumped after a successful POST /stock-movements so live list views
  // (the Movements tab) can refetch with their current filters.
  private readonly _refreshTick = signal(0);

  readonly movements = this._movements.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly activeProductId = this._activeProductId.asReadonly();
  readonly hasMovements = computed(() => this._movements().length > 0);

  readonly searchItems = this._searchItems.asReadonly();
  readonly searchTotalCount = this._searchTotalCount.asReadonly();
  readonly searchLoading = this._searchLoading.asReadonly();

  readonly todaySummary = this._todaySummary.asReadonly();
  readonly todaySummaryLoading = this._todaySummaryLoading.asReadonly();

  readonly refreshTick = this._refreshTick.asReadonly();

  constructor() {
    this.sessionState.registerResetter(() => this.resetSessionState());
  }

  search(params: StockMovementSearchParams): Observable<PagedResult<StockMovementResponse>> {
    const generation = this.sessionState.captureGeneration();
    const httpParams = this.buildSearchParams(params);
    this._searchLoading.set(true);
    return this.http
      .get<PagedResult<StockMovementResponse>>(this.baseUrl, { params: httpParams })
      .pipe(
        tap({
          next: (res) => {
            if (!this.sessionState.isCurrentGeneration(generation)) return;
            this._searchItems.set(res.items);
            this._searchTotalCount.set(res.totalCount);
            this._searchLoading.set(false);
          },
          error: () => {
            if (this.sessionState.isCurrentGeneration(generation)) this._searchLoading.set(false);
          },
        }),
      );
  }

  loadTodaySummary(brandIdScope?: string): Observable<StockMovementTodaySummary> {
    const generation = this.sessionState.captureGeneration();
    this._todaySummaryLoading.set(true);
    const today = formatUruguayDate();
    const params: StockMovementSearchParams = {
      from: today,
      to: today,
      page: 1,
      pageSize: 100,
    };
    if (brandIdScope) params.brandId = brandIdScope;

    const firstPage$ = this.http.get<PagedResult<StockMovementResponse>>(this.baseUrl, {
      params: this.buildSearchParams(params),
    });

    return firstPage$.pipe(
      switchMap((first) => {
        const totalPages = Math.max(1, Math.ceil(first.totalCount / params.pageSize!));
        if (totalPages <= 1) return of([first]);

        const remainingPages$ = Array.from({ length: totalPages - 1 }, (_, i) =>
          this.http.get<PagedResult<StockMovementResponse>>(this.baseUrl, {
            params: this.buildSearchParams({ ...params, page: i + 2 }),
          }),
        );

        return forkJoin(remainingPages$).pipe(map((rest) => [first, ...rest]));
      }),
      map((pages) =>
        summarizeToday(
          pages.flatMap((page) => page.items),
          pages[0]?.totalCount ?? 0,
        ),
      ),
      tap((summary) => {
        if (this.sessionState.isCurrentGeneration(generation)) this._todaySummary.set(summary);
      }),
      finalize(() => {
        if (this.sessionState.isCurrentGeneration(generation)) {
          this._todaySummaryLoading.set(false);
        }
      }),
    );
  }

  loadByProduct(
    productId: string,
    page = 1,
    pageSize = 20,
  ): Observable<PagedResult<StockMovementResponse>> {
    const generation = this.sessionState.captureGeneration();
    this._loading.set(true);
    this._activeProductId.set(productId);
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http
      .get<PagedResult<StockMovementResponse>>(`${this.baseUrl}/product/${productId}`, {
        params,
      })
      .pipe(
        tap({
          next: (res) => {
            if (!this.sessionState.isCurrentGeneration(generation)) return;
            this._movements.set(res.items);
            this._totalCount.set(res.totalCount);
            this._loading.set(false);
          },
          error: () => {
            if (this.sessionState.isCurrentGeneration(generation)) this._loading.set(false);
          },
        }),
      );
  }

  clear(): void {
    this._movements.set([]);
    this._totalCount.set(0);
    this._activeProductId.set(null);
  }

  create(req: CreateStockMovementRequest): Observable<StockMovementResponse> {
    const generation = this.sessionState.captureGeneration();
    return this.http.post<StockMovementResponse>(this.baseUrl, req).pipe(
      tap((created) => {
        if (!this.sessionState.isCurrentGeneration(generation)) return;
        // The backend coerces the sign for StockIn/Sale/Return; trust the
        // response's quantity to know the actual delta applied to stock.
        this.products.applyStockDelta(created.productId, created.quantity);

        if (this._activeProductId() === created.productId) {
          this._movements.update((curr) => [created, ...curr]);
          this._totalCount.update((c) => c + 1);
        }

        // Signal live list views to refetch with their current filters.
        this._refreshTick.update((t) => t + 1);
      }),
    );
  }

  private buildSearchParams(params: StockMovementSearchParams): HttpParams {
    let p = new HttpParams();
    if (params.productId) p = p.set('productId', params.productId);
    if (params.brandId) p = p.set('brandId', params.brandId);
    if (params.type) p = p.set('type', params.type);
    if (params.from) p = p.set('from', params.from);
    if (params.to) p = p.set('to', params.to);
    p = p.set('page', params.page ?? 1);
    p = p.set('pageSize', params.pageSize ?? 20);
    return p;
  }

  private resetSessionState(): void {
    this._movements.set([]);
    this._totalCount.set(0);
    this._loading.set(false);
    this._activeProductId.set(null);
    this._searchItems.set([]);
    this._searchTotalCount.set(0);
    this._searchLoading.set(false);
    this._todaySummary.set(EMPTY_TODAY_SUMMARY);
    this._todaySummaryLoading.set(false);
    this._refreshTick.set(0);
  }
}

function summarizeToday(
  movements: readonly StockMovementResponse[],
  totalCount: number,
): StockMovementTodaySummary {
  return movements.reduce<StockMovementTodaySummary>(
    (summary, movement) => {
      if (movement.quantity > 0) {
        return {
          ...summary,
          inboundUnits: summary.inboundUnits + movement.quantity,
        };
      }
      if (movement.quantity < 0) {
        return {
          ...summary,
          outboundUnits: summary.outboundUnits + Math.abs(movement.quantity),
        };
      }
      return summary;
    },
    { ...EMPTY_TODAY_SUMMARY, totalCount },
  );
}
