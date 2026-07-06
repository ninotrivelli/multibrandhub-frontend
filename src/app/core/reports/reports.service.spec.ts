import { HttpHeaders, HttpResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import {
  makeReportExportPreview,
  makeReportExportTemplates,
} from '../../../testing/builders';
import { fallbackReportFileName, resolveReportFileName } from './reports.utils';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/reports/exports`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the export template catalog', () => {
    const catalog = makeReportExportTemplates();
    let result: typeof catalog | undefined;

    service.getTemplates().subscribe((res) => (result = res));

    const req = http.expectOne(`${baseUrl}/templates`);
    expect(req.request.method).toBe('GET');
    req.flush(catalog);

    expect(result).toEqual(catalog);
  });

  it('posts a preview request body', () => {
    const preview = makeReportExportPreview();
    const request = {
      reportType: 'SalesDetail' as const,
      from: '2026-06-01',
      to: '2026-06-30',
      brandIds: ['brand-a'],
      paymentMethods: ['Cash' as const],
    };
    let result: typeof preview | undefined;

    service.preview(request).subscribe((res) => (result = res));

    const req = http.expectOne(`${baseUrl}/preview`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(preview);

    expect(result).toEqual(preview);
  });

  it('exports Excel as a blob response', () => {
    const request = {
      reportType: 'LocalMonthlyClose' as const,
      from: '2026-06-01',
      to: '2026-06-30',
    };
    let response: HttpResponse<Blob> | undefined;

    service.exportExcel(request).subscribe((res) => (response = res));

    const req = http.expectOne(`${baseUrl}/excel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.body).toEqual(request);
    req.flush(new Blob(['xlsx']), {
      headers: new HttpHeaders({
        'content-disposition': 'attachment; filename="LocalMonthlyClose-20260601-20260630.xlsx"',
      }),
    });

    expect(response?.body).toBeInstanceOf(Blob);
    expect(
      resolveReportFileName(response!, fallbackReportFileName(request.reportType, request.from, request.to)),
    ).toBe('LocalMonthlyClose-20260601-20260630.xlsx');
  });

  it('falls back to a deterministic Excel filename when the header is hidden', () => {
    const response = new HttpResponse<Blob>({ body: new Blob(['xlsx']) });

    expect(
      resolveReportFileName(
        response,
        fallbackReportFileName('BrandSettlements', '2026-06-01', '2026-06-30'),
      ),
    ).toBe('BrandSettlements-20260601-20260630.xlsx');
  });
});
