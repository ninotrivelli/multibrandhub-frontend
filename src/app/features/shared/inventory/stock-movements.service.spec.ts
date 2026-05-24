import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { makeMovement, makeProduct, paged } from '../../../../testing/builders';
import { MovementType } from './inventory.types';
import { formatUruguayDate } from './inventory.utils';
import { ProductsService } from './products.service';
import { StockMovementsService } from './stock-movements.service';

describe('StockMovementsService', () => {
  let service: StockMovementsService;
  let products: ProductsService;
  let http: HttpTestingController;
  const movementsUrl = `${environment.apiBaseUrl}/stock-movements`;
  const productsUrl = `${environment.apiBaseUrl}/products`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StockMovementsService);
    products = TestBed.inject(ProductsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searches movement history with filters and updates search state', () => {
    const movement = makeMovement({ type: MovementType.Loss, quantity: -2 });

    service
      .search({
        productId: 'product-1',
        brandId: 'brand-own',
        type: MovementType.Loss,
        from: '2026-05-01',
        to: '2026-05-23',
        page: 2,
        pageSize: 30,
      })
      .subscribe();

    expect(service.searchLoading()).toBe(true);
    const req = http.expectOne((request) => request.url === movementsUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('productId')).toBe('product-1');
    expect(req.request.params.get('brandId')).toBe('brand-own');
    expect(req.request.params.get('type')).toBe('Loss');
    expect(req.request.params.get('from')).toBe('2026-05-01');
    expect(req.request.params.get('to')).toBe('2026-05-23');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('30');

    req.flush(paged([movement], { totalCount: 9 }));

    expect(service.searchItems()).toEqual([movement]);
    expect(service.searchTotalCount()).toBe(9);
    expect(service.searchLoading()).toBe(false);
  });

  it('summarizes today using Uruguay date filters', () => {
    service.loadTodaySummary('brand-own').subscribe();

    const req = http.expectOne((request) => request.url === movementsUrl);
    expect(req.request.params.get('from')).toBe(formatUruguayDate());
    expect(req.request.params.get('to')).toBe(formatUruguayDate());
    expect(req.request.params.get('brandId')).toBe('brand-own');
    expect(req.request.params.get('pageSize')).toBe('100');

    req.flush(
      paged([
        makeMovement({ id: 'in', quantity: 4 }),
        makeMovement({ id: 'out', quantity: -3, type: MovementType.Loss }),
      ]),
    );

    expect(service.todaySummary()).toEqual({
      totalCount: 2,
      inboundUnits: 4,
      outboundUnits: 3,
    });
    expect(service.todaySummaryLoading()).toBe(false);
  });

  it('applies backend stock deltas and refresh ticks after creating a movement', () => {
    const product = makeProduct({ id: 'product-1', currentStock: 5 });
    products.search({ page: 1, pageSize: 12 }).subscribe();
    http.expectOne((request) => request.url === `${productsUrl}/search`).flush(paged([product]));

    service.loadByProduct(product.id).subscribe();
    http
      .expectOne((request) => request.url === `${movementsUrl}/product/${product.id}`)
      .flush(paged([]));

    const initialTick = service.refreshTick();
    const created = makeMovement({
      productId: product.id,
      quantity: -2,
      type: MovementType.Loss,
    });

    service
      .create({
        productId: product.id,
        quantity: 2,
        type: MovementType.Loss,
        observations: 'Rotura',
        userId: 'user-admin',
      })
      .subscribe();

    const req = http.expectOne(movementsUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      productId: product.id,
      quantity: 2,
      type: MovementType.Loss,
      observations: 'Rotura',
      userId: 'user-admin',
    });
    req.flush(created);

    expect(products.items()[0]?.currentStock).toBe(3);
    expect(service.movements()).toEqual([created]);
    expect(service.totalCount()).toBe(1);
    expect(service.refreshTick()).toBe(initialTick + 1);
  });
});
