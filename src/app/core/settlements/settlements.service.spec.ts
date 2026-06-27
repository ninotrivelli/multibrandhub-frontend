import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { makeBrandSettlementEstimate, makeSettlement, paged } from '../../../testing/builders';
import { SettlementsService } from './settlements.service';

describe('SettlementsService', () => {
  let service: SettlementsService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/settlements/brands`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SettlementsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searches saved settlements with backend query names and default superseded flag', () => {
    service
      .searchSaved({
        from: '2026-06-01',
        to: '2026-06-30',
        brandId: 'brand-a',
        status: 'Finalized',
        page: 2,
        pageSize: 50,
      })
      .subscribe();

    const req = http.expectOne((request) => request.url === `${baseUrl}/saved`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('From')).toBe('2026-06-01');
    expect(req.request.params.get('To')).toBe('2026-06-30');
    expect(req.request.params.get('BrandId')).toBe('brand-a');
    expect(req.request.params.get('Status')).toBe('Finalized');
    expect(req.request.params.get('IncludeSuperseded')).toBe('false');
    expect(req.request.params.get('Page')).toBe('2');
    expect(req.request.params.get('PageSize')).toBe('50');
    req.flush(paged([makeSettlement()]));
  });

  it('POSTs generate with the persisted-settlement payload shape', () => {
    const generated = makeSettlement({ id: 'settlement-new' });

    service
      .generate({
        from: '2026-06-01',
        to: '2026-06-30',
        brandId: 'brand-a',
        notes: 'Junio',
      })
      .subscribe();

    const req = http.expectOne(`${baseUrl}/generate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
      brandId: 'brand-a',
      notes: 'Junio',
    });
    req.flush([generated]);
  });

  it('omits paidAtUtc when marking paid without an explicit date', () => {
    service
      .markPaid('settlement-1', {
        paymentReference: 'TRX-1',
        notes: null,
      })
      .subscribe();

    const req = http.expectOne(`${baseUrl}/saved/settlement-1/mark-paid`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      paymentReference: 'TRX-1',
      notes: null,
    });
    req.flush(makeSettlement({ status: 'Paid' }));
  });

  it('fetches detail, versions, and finalize endpoints', () => {
    service.getSavedById('settlement-1').subscribe();
    const detail = http.expectOne(`${baseUrl}/saved/settlement-1`);
    expect(detail.request.method).toBe('GET');
    detail.flush(makeSettlement());

    service.getVersions('settlement-1').subscribe();
    const versions = http.expectOne(`${baseUrl}/saved/settlement-1/versions`);
    expect(versions.request.method).toBe('GET');
    versions.flush([makeSettlement()]);

    service.finalize('settlement-1').subscribe();
    const finalize = http.expectOne(`${baseUrl}/saved/settlement-1/finalize`);
    expect(finalize.request.method).toBe('POST');
    expect(finalize.request.body).toBeNull();
    finalize.flush(makeSettlement({ status: 'Finalized' }));
  });

  it('loads an estimated settlement for one brand with backend query names', () => {
    const estimate = makeBrandSettlementEstimate();
    let result: typeof estimate | undefined;

    service
      .getByBrand('brand-a', {
        from: '2026-06-01',
        to: '2026-06-30',
      })
      .subscribe((res) => (result = res));

    const req = http.expectOne(`${baseUrl}/brand-a?From=2026-06-01&To=2026-06-30`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('From')).toBe('2026-06-01');
    expect(req.request.params.get('To')).toBe('2026-06-30');

    req.flush(estimate);
    expect(result).toEqual(estimate);
  });
});
