import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import {
  makeSale,
  makeSaleSearch,
  makeSalesDashboard,
  makeSalesSummary,
  makeTopSellingProducts,
  paged,
} from '../../../testing/builders';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  let service: SalesService;
  let sessionState: SessionStateRegistry;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/sales`;
  const reportsSalesUrl = `${environment.apiBaseUrl}/reports/sales`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SalesService);
    sessionState = TestBed.inject(SessionStateRegistry);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('POSTs a sale to /sales and returns the created sale', () => {
    const created = makeSale();
    let result = undefined as ReturnType<typeof makeSale> | undefined;

    service
      .create({
        paymentMethod: 'CreditCard',
        cardBrand: 'Visa',
        details: [
          { productId: 'product-1', quantity: 2, discountType: 'Percentage', discountValue: 10 },
        ],
        observations: 'Promo',
      })
      .subscribe((res) => (result = res));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      paymentMethod: 'CreditCard',
      cardBrand: 'Visa',
      details: [
        { productId: 'product-1', quantity: 2, discountType: 'Percentage', discountValue: 10 },
      ],
      observations: 'Promo',
    });
    req.flush(created);
    expect(result).toEqual(created);
  });

  it('POSTs a return to /sales/return', () => {
    const created = makeSale({ type: 'Return', totalAmount: -1850 });

    service
      .createReturn({
        originalSaleId: 'sale-1',
        details: [{ originalSaleDetailId: 'detail-1', quantity: 1 }],
        observations: null,
      })
      .subscribe();

    const req = http.expectOne(`${baseUrl}/return`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      originalSaleId: 'sale-1',
      details: [{ originalSaleDetailId: 'detail-1', quantity: 1 }],
      observations: null,
    });
    req.flush(created);
  });

  it('PATCHes a sale cancellation to /sales/{id}/cancel', () => {
    let completed = false;

    service.cancel('sale-1').subscribe(() => (completed = true));

    const req = http.expectOne(`${baseUrl}/sale-1/cancel`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('search updates the recent-list signals and sends trimmed params', () => {
    const item = makeSaleSearch();

    service
      .search({ searchTerm: '  zendra ', brandId: 'brand-own', page: 2, pageSize: 20 })
      .subscribe();

    expect(service.recentLoading()).toBe(true);

    const req = http.expectOne((r) => r.url === `${baseUrl}/search`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('searchTerm')).toBe('zendra');
    expect(req.request.params.get('brandId')).toBe('brand-own');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');

    req.flush(paged([item], { totalCount: 5, page: 2, pageSize: 20 }));

    expect(service.recentItems()).toEqual([item]);
    expect(service.recentTotal()).toBe(5);
    expect(service.recentLoading()).toBe(false);
  });

  it('searchOnce does NOT touch the recent-list signals', () => {
    service.searchOnce({ searchTerm: 'remera' }).subscribe();
    expect(service.recentLoading()).toBe(false);

    const req = http.expectOne((r) => r.url === `${baseUrl}/search`);
    expect(req.request.params.get('searchTerm')).toBe('remera');
    req.flush(paged([makeSaleSearch()], { totalCount: 1 }));

    expect(service.recentItems()).toEqual([]);
    expect(service.recentTotal()).toBe(0);
  });

  it('clears recent sales and ignores late search responses after session reset', () => {
    const item = makeSaleSearch();

    service.search({ page: 1, pageSize: 10 }).subscribe();
    const req = http.expectOne((r) => r.url === `${baseUrl}/search`);
    expect(service.recentLoading()).toBe(true);

    sessionState.resetAll();

    expect(service.recentItems()).toEqual([]);
    expect(service.recentTotal()).toBe(0);
    expect(service.recentLoading()).toBe(false);

    req.flush(paged([item], { totalCount: 1 }));

    expect(service.recentItems()).toEqual([]);
    expect(service.recentTotal()).toBe(0);
  });

  it('getById fetches a single sale', () => {
    const sale = makeSale();
    service.getById('sale-1').subscribe();
    const req = http.expectOne(`${baseUrl}/sale-1`);
    expect(req.request.method).toBe('GET');
    req.flush(sale);
  });

  it('loads the dashboard with repeated brandIds params', () => {
    const dashboard = makeSalesDashboard();
    let result: typeof dashboard | undefined;

    service
      .getDashboard({
        from: '2026-06-01',
        to: '2026-06-05',
        chartWeekStart: '2026-06-01',
        brandIds: ['brand-a', 'brand-b'],
        page: 2,
        pageSize: 20,
      })
      .subscribe((res) => (result = res));

    const req = http.expectOne((r) => r.url === `${reportsSalesUrl}/dashboard`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-06-01');
    expect(req.request.params.get('to')).toBe('2026-06-05');
    expect(req.request.params.get('chartWeekStart')).toBe('2026-06-01');
    expect(req.request.params.getAll('brandIds')).toEqual(['brand-a', 'brand-b']);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');

    req.flush(dashboard);
    expect(result).toEqual(dashboard);
  });

  it('loads a sales summary with optional brand scope', () => {
    const summary = makeSalesSummary({ brandId: 'brand-a' });
    let result: typeof summary | undefined;

    service
      .getSummary({
        from: '2026-06-05',
        to: '2026-06-05',
        brandId: 'brand-a',
      })
      .subscribe((res) => (result = res));

    const req = http.expectOne((r) => r.url === `${reportsSalesUrl}/summary`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-06-05');
    expect(req.request.params.get('to')).toBe('2026-06-05');
    expect(req.request.params.get('brandId')).toBe('brand-a');

    req.flush(summary);
    expect(result).toEqual(summary);
  });

  it('loads top products with optional brand scope and limit', () => {
    const topProducts = makeTopSellingProducts();
    let result: typeof topProducts | undefined;

    service
      .getTopProducts({
        from: '2026-06-01',
        to: '2026-06-30',
        brandId: 'brand-a',
        limit: 10,
      })
      .subscribe((res) => (result = res));

    const req = http.expectOne((r) => r.url === `${reportsSalesUrl}/top-products`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-06-01');
    expect(req.request.params.get('to')).toBe('2026-06-30');
    expect(req.request.params.get('brandId')).toBe('brand-a');
    expect(req.request.params.get('limit')).toBe('10');

    req.flush(topProducts);
    expect(result).toEqual(topProducts);
  });
});
