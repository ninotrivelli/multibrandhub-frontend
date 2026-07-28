import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { makeImmobilizedProduct, makeProduct, paged } from '../../../../testing/builders';
import { SessionStateRegistry } from '../../../core/session/session-state-registry.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let sessionState: SessionStateRegistry;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/products`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductsService);
    sessionState = TestBed.inject(SessionStateRegistry);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searches with trimmed filters, repeated stock statuses, and pagination', () => {
    const product = makeProduct();

    service
      .search({
        searchTerm: '  buzo  ',
        brandId: 'brand-own',
        categoryId: 'cat-tops',
        color: ' negro ',
        size: ' M ',
        stockStatuses: ['Critical', 'OutOfStock'],
        onlyInStock: true,
        includeInactive: true,
        sortBy: 'createdAt',
        sortDirection: 'desc',
        page: 2,
        pageSize: 25,
      })
      .subscribe();

    expect(service.loading()).toBe(true);

    const req = http.expectOne((request) => request.url === `${baseUrl}/search`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('searchTerm')).toBe('buzo');
    expect(req.request.params.get('brandId')).toBe('brand-own');
    expect(req.request.params.get('categoryId')).toBe('cat-tops');
    expect(req.request.params.get('color')).toBe('negro');
    expect(req.request.params.get('size')).toBe('M');
    expect(req.request.params.getAll('stockStatuses')).toEqual(['Critical', 'OutOfStock']);
    expect(req.request.params.has('stockStatus')).toBe(false);
    expect(req.request.params.get('onlyInStock')).toBe('true');
    expect(req.request.params.get('includeInactive')).toBe('true');
    expect(req.request.params.get('sortBy')).toBe('createdAt');
    expect(req.request.params.get('sortDirection')).toBe('desc');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('25');

    req.flush(paged([product], { totalCount: 7, page: 2, pageSize: 25 }));

    expect(service.items()).toEqual([product]);
    expect(service.totalCount()).toBe(7);
    expect(service.loading()).toBe(false);
  });

  it('clears product state and ignores late search responses after session reset', () => {
    const product = makeProduct();

    service.search({ page: 1, pageSize: 12 }).subscribe();
    const req = http.expectOne((request) => request.url === `${baseUrl}/search`);
    expect(service.loading()).toBe(true);

    sessionState.resetAll();

    expect(service.items()).toEqual([]);
    expect(service.totalCount()).toBe(0);
    expect(service.loading()).toBe(false);

    req.flush(paged([product], { totalCount: 1 }));

    expect(service.items()).toEqual([]);
    expect(service.totalCount()).toBe(0);
  });

  it('updates list state optimistically after product mutations', () => {
    const original = makeProduct({ id: 'product-1', name: 'Buzo' });
    service.search({ page: 1, pageSize: 12 }).subscribe();
    http
      .expectOne((request) => request.url === `${baseUrl}/search`)
      .flush(paged([original], { totalCount: 1 }));

    const created = makeProduct({ id: 'product-2', name: 'Camisa' });
    service
      .create({
        sku: created.sku,
        name: created.name,
        description: null,
        imageUrl: null,
        price: created.price,
        color: created.color,
        size: created.size,
        currentStock: created.currentStock,
        minStockAlert: null,
        brandId: created.brandId,
        categoryId: created.categoryId,
      })
      .subscribe();
    let req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    req.flush(created);

    expect(service.items().map((item) => item.id)).toEqual(['product-2', 'product-1']);
    expect(service.totalCount()).toBe(2);

    const updated = makeProduct({ ...created, name: 'Camisa editada' });
    service
      .update(created.id, {
        name: updated.name,
        description: null,
        imageUrl: null,
        price: updated.price,
        color: updated.color,
        size: updated.size,
        minStockAlert: updated.minStockAlert,
        categoryId: updated.categoryId,
      })
      .subscribe();
    req = http.expectOne(`${baseUrl}/${created.id}`);
    expect(req.request.method).toBe('PUT');
    req.flush(updated);
    expect(service.items()[0]?.name).toBe('Camisa editada');

    service.archive(created.id).subscribe();
    req = http.expectOne(`${baseUrl}/${created.id}/archive`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...updated, isActive: false, archivedAtUtc: '2026-05-01T00:00:00Z' });
    expect(service.items().map((item) => item.id)).toEqual(['product-1']);
    expect(service.totalCount()).toBe(1);

    service.delete(original.id).subscribe();
    req = http.expectOne(`${baseUrl}/${original.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    expect(service.items()).toEqual([]);
    expect(service.totalCount()).toBe(0);
  });

  it('uploads and clears product images while replacing cached products', () => {
    const original = makeProduct({ id: 'product-1', imageUrl: null });
    service.search({ page: 1, pageSize: 12 }).subscribe();
    http
      .expectOne((request) => request.url === `${baseUrl}/search`)
      .flush(paged([original], { totalCount: 1 }));

    service.loadAll().subscribe();
    http
      .expectOne((request) => request.url === `${baseUrl}/search`)
      .flush(paged([original], { totalCount: 1 }));

    const file = new File(['image'], 'producto.png', { type: 'image/png' });
    const withImage = makeProduct({
      ...original,
      imageUrl: 'https://cdn.test/producto.webp',
    });
    service.uploadImage(original.id, file).subscribe();

    let req = http.expectOne(`${baseUrl}/${original.id}/image`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect(req.request.body.get('file')).toBe(file);
    req.flush(withImage);

    expect(service.items()[0]?.imageUrl).toBe('https://cdn.test/producto.webp');
    expect(service.allItems()[0]?.imageUrl).toBe('https://cdn.test/producto.webp');

    const withoutImage = makeProduct({ ...original, imageUrl: null });
    service.clearImage(original.id).subscribe();

    req = http.expectOne(`${baseUrl}/${original.id}/image`);
    expect(req.request.method).toBe('DELETE');
    req.flush(withoutImage);

    expect(service.items()[0]?.imageUrl).toBeNull();
    expect(service.allItems()[0]?.imageUrl).toBeNull();
  });

  it('loads KPI, all-items, import, and immobilized endpoints with the expected contract', () => {
    service.loadKpiCounts('brand-own').subscribe();
    const total = http.expectOne(
      (req) =>
        req.url === `${baseUrl}/search` &&
        req.params.get('brandId') === 'brand-own' &&
        !req.params.has('stockStatus'),
    );
    const critical = http.expectOne(
      (req) => req.url === `${baseUrl}/search` && req.params.get('stockStatus') === 'Critical',
    );
    const outOfStock = http.expectOne(
      (req) => req.url === `${baseUrl}/search` && req.params.get('stockStatus') === 'OutOfStock',
    );
    total.flush(paged([], { totalCount: 10 }));
    critical.flush(paged([], { totalCount: 2 }));
    outOfStock.flush(paged([], { totalCount: 1 }));
    expect(service.kpiCounts()).toEqual({ total: 10, critical: 2, outOfStock: 1 });

    const file = new File(['SKU,Nombre'], 'productos.csv', { type: 'text/csv' });
    service.importProducts('brand-own', file).subscribe();
    const importReq = http.expectOne(`${baseUrl}/import`);
    expect(importReq.request.method).toBe('POST');
    expect(importReq.request.body instanceof FormData).toBe(true);
    expect(importReq.request.body.get('brandId')).toBe('brand-own');
    expect(importReq.request.body.get('file')).toBe(file);
    importReq.flush({ totalRows: 1, created: 1, rejected: 0, errors: [] });

    service.loadImmobilizedCount('brand-own', 60).subscribe();
    const countReq = http.expectOne((request) => request.url === `${baseUrl}/immobilized-stock`);
    expect(countReq.request.params.get('days')).toBe('60');
    expect(countReq.request.params.get('pageSize')).toBe('1');
    expect(countReq.request.params.get('brandId')).toBe('brand-own');
    countReq.flush(paged([], { totalCount: 4 }));
    expect(service.immobilizedCount()).toBe(4);

    const immobilized = makeImmobilizedProduct();
    service
      .searchImmobilized({ days: 60, brandId: 'brand-own', page: 3, pageSize: 12 })
      .subscribe();
    const searchReq = http.expectOne((request) => request.url === `${baseUrl}/immobilized-stock`);
    expect(searchReq.request.params.get('page')).toBe('3');
    expect(searchReq.request.params.get('pageSize')).toBe('12');
    searchReq.flush(paged([immobilized], { totalCount: 1 }));
    expect(service.immobilizedItems()).toEqual([immobilized]);
    expect(service.immobilizedTotal()).toBe(1);
  });

  it('supports lookup, validation, detail, template, and single-status query contracts', () => {
    service
      .searchOnce({
        stockStatus: 'Critical',
        searchTerm: '   ',
      })
      .subscribe();
    let req = http.expectOne((request) => request.url === `${baseUrl}/search`);
    expect(req.request.params.get('stockStatus')).toBe('Critical');
    expect(req.request.params.has('searchTerm')).toBe(false);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('12');
    req.flush(paged([]));

    service.getById('product-1').subscribe();
    req = http.expectOne(`${baseUrl}/product-1`);
    expect(req.request.method).toBe('GET');
    req.flush(makeProduct());

    service.validateSku('SKU-001').subscribe();
    req = http.expectOne((request) => request.url === `${baseUrl}/sku-validation`);
    expect(req.request.params.get('sku')).toBe('SKU-001');
    req.flush({ isAvailable: true });

    service.downloadImportTemplate().subscribe();
    req = http.expectOne(`${baseUrl}/import-template`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['template']));
  });

  it('loads every aggregate inventory page and preserves backend order', () => {
    const first = makeProduct({ id: 'first' });
    const second = makeProduct({ id: 'second' });
    const third = makeProduct({ id: 'third' });
    let result: any[] = [];

    service.loadAll('brand-own').subscribe((items) => (result = items));
    const firstReq = http.expectOne(
      (request) =>
        request.url === `${baseUrl}/search` &&
        request.params.get('page') === '1' &&
        request.params.get('brandId') === 'brand-own',
    );
    firstReq.flush(paged([first], { totalCount: 201, page: 1, pageSize: 100 }));

    const remaining = http.match((request) => request.url === `${baseUrl}/search`);
    expect(remaining).toHaveLength(2);
    const page2 = remaining.find((request) => request.request.params.get('page') === '2')!;
    const page3 = remaining.find((request) => request.request.params.get('page') === '3')!;
    page2.flush(paged([second], { totalCount: 201, page: 2, pageSize: 100 }));
    page3.flush(paged([third], { totalCount: 201, page: 3, pageSize: 100 }));

    expect(result.map((item) => item.id)).toEqual(['first', 'second', 'third']);
    expect(service.allItems().map((item) => item.id)).toEqual(['first', 'second', 'third']);
    expect(service.allItemsLoading()).toBe(false);
  });

  it('reactivates archived cached products and applies stock deltas to every cache', () => {
    const archived = makeProduct({
      id: 'archived',
      isActive: false,
      archivedAtUtc: '2026-07-01T00:00:00Z',
      currentStock: 2,
    });
    service.search({ includeInactive: true }).subscribe();
    http
      .expectOne((request) => request.url === `${baseUrl}/search`)
      .flush(paged([archived], { totalCount: 1 }));
    service.loadAll().subscribe();
    http
      .expectOne((request) => request.url === `${baseUrl}/search`)
      .flush(paged([archived], { totalCount: 1 }));

    service.archive(archived.id).subscribe();
    let req = http.expectOne(`${baseUrl}/${archived.id}/archive`);
    req.flush(archived);
    expect(service.items()[0]?.id).toBe('archived');
    expect(service.totalCount()).toBe(0);
    expect(service.allItems()).toEqual([]);

    const reactivated = makeProduct({ ...archived, isActive: true, archivedAtUtc: null });
    service.reactivate(archived.id).subscribe();
    req = http.expectOne(`${baseUrl}/${archived.id}/reactivate`);
    req.flush(reactivated);
    expect(service.items()[0]?.isActive).toBe(true);

    service.applyStockDelta('archived', 3);
    expect(service.items()[0]?.currentStock).toBe(5);
    service.applyStockDelta('missing', 10);
    expect(service.items()[0]?.currentStock).toBe(5);
  });

  it('clears all loading flags after failed searches and aggregate requests', () => {
    service.search({}).subscribe({ error: () => undefined });
    let req = http.expectOne((request) => request.url === `${baseUrl}/search`);
    req.flush('error', { status: 500, statusText: 'Server Error' });
    expect(service.loading()).toBe(false);

    service.searchImmobilized({ days: 30 }).subscribe({ error: () => undefined });
    req = http.expectOne((request) => request.url === `${baseUrl}/immobilized-stock`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('12');
    expect(req.request.params.has('brandId')).toBe(false);
    req.flush('error', { status: 500, statusText: 'Server Error' });
    expect(service.loading()).toBe(false);

    service.loadImmobilizedCount(undefined, 30).subscribe({ error: () => undefined });
    req = http.expectOne((request) => request.url === `${baseUrl}/immobilized-stock`);
    expect(req.request.params.has('brandId')).toBe(false);
    req.flush('error', { status: 500, statusText: 'Server Error' });
    expect(service.immobilizedLoading()).toBe(false);
  });
});
