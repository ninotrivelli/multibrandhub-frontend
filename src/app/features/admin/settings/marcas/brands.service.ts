import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import {
  BrandOffboardingResponse,
  BrandResponse,
  CreateBrandRequest,
  ListBrandsParams,
  PagedResult,
  UpdateBrandRequest,
} from './brands.types';

@Injectable({ providedIn: 'root' })
export class BrandsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/brands`;

  private readonly _items = signal<BrandResponse[]>([]);
  private readonly _totalCount = signal(0);
  private readonly _loading = signal(false);

  readonly items = this._items.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly hasItems = computed(() => this._items().length > 0);

  list({ page = 1, pageSize = 100, includeArchived = false }: ListBrandsParams = {}): Observable<
    PagedResult<BrandResponse>
  > {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (includeArchived) {
      params = params.set('includeArchived', true);
    }
    this._loading.set(true);
    return this.http.get<PagedResult<BrandResponse>>(this.baseUrl, { params }).pipe(
      tap({
        next: (res) => {
          this._items.set(res.items);
          this._totalCount.set(res.totalCount);
          this._loading.set(false);
        },
        error: () => this._loading.set(false),
      }),
    );
  }

  getById(id: string): Observable<BrandResponse> {
    return this.http.get<BrandResponse>(`${this.baseUrl}/${id}`);
  }

  create(req: CreateBrandRequest): Observable<BrandResponse> {
    return this.http
      .post<BrandResponse>(this.baseUrl, req)
      .pipe(tap((created) => this._items.update((curr) => [created, ...curr])));
  }

  update(id: string, req: UpdateBrandRequest): Observable<BrandResponse> {
    return this.http
      .put<BrandResponse>(`${this.baseUrl}/${id}`, req)
      .pipe(
        tap((updated) =>
          this._items.update((curr) => curr.map((brand) => (brand.id === id ? updated : brand))),
        ),
      );
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(tap(() => this._items.update((curr) => curr.filter((brand) => brand.id !== id))));
  }

  offboard(id: string): Observable<BrandOffboardingResponse> {
    return this.http
      .post<BrandOffboardingResponse>(`${this.baseUrl}/${id}/offboard`, null)
      .pipe(
        tap((res) =>
          this._items.update((curr) =>
            curr.map((brand) =>
              brand.id === id
                ? { ...brand, status: res.status, archivedAtUtc: res.archivedAtUtc }
                : brand,
            ),
          ),
        ),
      );
  }
}
