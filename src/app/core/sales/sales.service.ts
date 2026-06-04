import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateReturnRequest,
  CreateSaleRequest,
  PagedResult,
  SaleResponse,
  SaleSearchParams,
  SaleSearchResponse,
} from './sales.types';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/sales`;

  // State for the POS "recent sales" feed. Mirrors the ProductsService /
  // BrandsService pattern: private writable signals exposed read-only.
  private readonly _recentItems = signal<SaleSearchResponse[]>([]);
  private readonly _recentTotal = signal(0);
  private readonly _recentLoading = signal(false);

  readonly recentItems = this._recentItems.asReadonly();
  readonly recentTotal = this._recentTotal.asReadonly();
  readonly recentLoading = this._recentLoading.asReadonly();
  readonly hasRecent = computed(() => this._recentItems().length > 0);

  create(req: CreateSaleRequest): Observable<SaleResponse> {
    return this.http.post<SaleResponse>(this.baseUrl, req);
  }

  createReturn(req: CreateReturnRequest): Observable<SaleResponse> {
    return this.http.post<SaleResponse>(`${this.baseUrl}/return`, req);
  }

  // Drives the recent-sales list. Updates the shared signals via tap().
  search(params: SaleSearchParams): Observable<PagedResult<SaleSearchResponse>> {
    const httpParams = this.buildSearchParams(params);
    this._recentLoading.set(true);
    return this.http
      .get<PagedResult<SaleSearchResponse>>(`${this.baseUrl}/search`, { params: httpParams })
      .pipe(
        tap({
          next: (res) => {
            this._recentItems.set(res.items);
            this._recentTotal.set(res.totalCount);
            this._recentLoading.set(false);
          },
          error: () => this._recentLoading.set(false),
        }),
      );
  }

  // Lookup-only variant. Does NOT touch the recent-list signals so the return
  // dialog can search original sales without clobbering the feed behind it.
  searchOnce(params: SaleSearchParams): Observable<PagedResult<SaleSearchResponse>> {
    const httpParams = this.buildSearchParams(params);
    return this.http.get<PagedResult<SaleSearchResponse>>(`${this.baseUrl}/search`, {
      params: httpParams,
    });
  }

  getById(id: string): Observable<SaleResponse> {
    return this.http.get<SaleResponse>(`${this.baseUrl}/${id}`);
  }

  private buildSearchParams(params: SaleSearchParams): HttpParams {
    let p = new HttpParams();
    if (params.searchTerm && params.searchTerm.trim().length > 0) {
      p = p.set('searchTerm', params.searchTerm.trim());
    }
    if (params.ticketId && params.ticketId.trim().length > 0) {
      p = p.set('ticketId', params.ticketId.trim());
    }
    if (params.brandId) p = p.set('brandId', params.brandId);
    if (params.saleType) p = p.set('saleType', params.saleType);
    if (params.startDate) p = p.set('startDate', params.startDate);
    if (params.endDate) p = p.set('endDate', params.endDate);
    p = p.set('page', params.page ?? 1);
    p = p.set('pageSize', params.pageSize ?? 10);
    return p;
  }
}
