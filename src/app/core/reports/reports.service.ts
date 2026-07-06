import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ReportExportPreviewResponse,
  ReportExportRequest,
  ReportExportTemplatesResponse,
} from './reports.types';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/reports/exports`;

  getTemplates(): Observable<ReportExportTemplatesResponse> {
    return this.http.get<ReportExportTemplatesResponse>(`${this.baseUrl}/templates`);
  }

  preview(request: ReportExportRequest): Observable<ReportExportPreviewResponse> {
    return this.http.post<ReportExportPreviewResponse>(`${this.baseUrl}/preview`, request);
  }

  exportExcel(request: ReportExportRequest): Observable<HttpResponse<Blob>> {
    return this.http.post(`${this.baseUrl}/excel`, request, {
      observe: 'response',
      responseType: 'blob',
    });
  }
}
