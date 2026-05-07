import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CreateStockMovementRequest,
  PagedResult,
  StockMovementResponse,
} from './inventory.types';
import { ProductsService } from './products.service';

@Injectable({ providedIn: 'root' })
export class StockMovementsService {
  private readonly http = inject(HttpClient);
  private readonly products = inject(ProductsService);
  private readonly baseUrl = `${environment.apiBaseUrl}/stock-movements`;

  private readonly _movements = signal<StockMovementResponse[]>([]);
  private readonly _totalCount = signal(0);
  private readonly _loading = signal(false);
  private readonly _activeProductId = signal<string | null>(null);

  readonly movements = this._movements.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly activeProductId = this._activeProductId.asReadonly();
  readonly hasMovements = computed(() => this._movements().length > 0);

  loadByProduct(
    productId: string,
    page = 1,
    pageSize = 20,
  ): Observable<PagedResult<StockMovementResponse>> {
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
            this._movements.set(res.items);
            this._totalCount.set(res.totalCount);
            this._loading.set(false);
          },
          error: () => this._loading.set(false),
        }),
      );
  }

  clear(): void {
    this._movements.set([]);
    this._totalCount.set(0);
    this._activeProductId.set(null);
  }

  create(req: CreateStockMovementRequest): Observable<StockMovementResponse> {
    return this.http.post<StockMovementResponse>(this.baseUrl, req).pipe(
      tap((created) => {
        // The backend coerces the sign for StockIn/Sale/Return; trust the
        // response's quantity to know the actual delta applied to stock.
        this.products.applyStockDelta(created.productId, created.quantity);

        if (this._activeProductId() === created.productId) {
          this._movements.update((curr) => [created, ...curr]);
          this._totalCount.update((c) => c + 1);
        }
      }),
    );
  }
}
