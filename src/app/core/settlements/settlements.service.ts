import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  BrandSettlementSavedResponse,
  GenerateBrandSettlementRequest,
  MarkBrandSettlementPaidRequest,
  PagedResult,
  SavedBrandSettlementSearchRequest,
} from './settlements.types';

@Injectable({ providedIn: 'root' })
export class SettlementsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settlements/brands`;

  generate(request: GenerateBrandSettlementRequest): Observable<BrandSettlementSavedResponse[]> {
    return this.http.post<BrandSettlementSavedResponse[]>(`${this.baseUrl}/generate`, request);
  }

  searchSaved(
    request: SavedBrandSettlementSearchRequest,
  ): Observable<PagedResult<BrandSettlementSavedResponse>> {
    return this.http.get<PagedResult<BrandSettlementSavedResponse>>(`${this.baseUrl}/saved`, {
      params: this.buildSavedSearchParams(request),
    });
  }

  getSavedById(id: string): Observable<BrandSettlementSavedResponse> {
    return this.http.get<BrandSettlementSavedResponse>(`${this.baseUrl}/saved/${id}`);
  }

  getVersions(id: string): Observable<BrandSettlementSavedResponse[]> {
    return this.http.get<BrandSettlementSavedResponse[]>(`${this.baseUrl}/saved/${id}/versions`);
  }

  finalize(id: string): Observable<BrandSettlementSavedResponse> {
    return this.http.post<BrandSettlementSavedResponse>(
      `${this.baseUrl}/saved/${id}/finalize`,
      null,
    );
  }

  markPaid(
    id: string,
    request: MarkBrandSettlementPaidRequest,
  ): Observable<BrandSettlementSavedResponse> {
    return this.http.post<BrandSettlementSavedResponse>(
      `${this.baseUrl}/saved/${id}/mark-paid`,
      request,
    );
  }

  private buildSavedSearchParams(request: SavedBrandSettlementSearchRequest): HttpParams {
    let params = new HttpParams()
      .set('IncludeSuperseded', request.includeSuperseded ?? false)
      .set('Page', request.page ?? 1)
      .set('PageSize', request.pageSize ?? 20);

    if (request.from) params = params.set('From', request.from);
    if (request.to) params = params.set('To', request.to);
    if (request.brandId) params = params.set('BrandId', request.brandId);
    if (request.status) params = params.set('Status', request.status);

    return params;
  }
}
