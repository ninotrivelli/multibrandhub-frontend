import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { makeCategory } from '../../../testing/builders';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { ProductCategoryResponse } from './product-categories.types';
import { ProductCategoriesService } from './product-categories.service';

describe('ProductCategoriesService', () => {
  let service: ProductCategoriesService;
  let sessionState: SessionStateRegistry;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/product-categories`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductCategoriesService);
    sessionState = TestBed.inject(SessionStateRegistry);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('caches category lists unless force reload is requested', () => {
    const categories = [makeCategory()];
    let latest: ProductCategoryResponse[] = [];

    service.list().subscribe((items) => {
      latest = items;
    });
    http.expectOne(baseUrl).flush(categories);

    expect(service.items()).toEqual(categories);
    expect(service.hasItems()).toBe(true);
    expect(latest).toEqual(categories);

    service.list().subscribe((items) => {
      latest = items;
    });
    http.expectNone(baseUrl);
    expect(latest).toEqual(categories);

    service.list(true).subscribe();
    http.expectOne(baseUrl).flush([makeCategory({ id: 'cat-dresses', name: 'Vestidos' })]);
    expect(service.items().map((category) => category.id)).toEqual(['cat-dresses']);
  });

  it('creates categories and updates the cache sorted by name', () => {
    service.list().subscribe();
    http.expectOne(baseUrl).flush([makeCategory({ id: 'cat-tops', name: 'Tops' })]);

    let created: ProductCategoryResponse | undefined;
    service.create({ name: ' Abrigos ' }).subscribe((category) => {
      created = category;
    });

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Abrigos' });
    req.flush(makeCategory({ id: 'cat-coats', name: 'Abrigos' }));

    expect(created!.name).toBe('Abrigos');
    expect(service.items().map((category) => category.name)).toEqual(['Abrigos', 'Tops']);
  });

  it('drops the per-session category cache on session reset', () => {
    service.list().subscribe();
    http.expectOne(baseUrl).flush([makeCategory()]);
    expect(service.hasItems()).toBe(true);

    sessionState.resetAll();

    expect(service.items()).toEqual([]);
    expect(service.hasItems()).toBe(false);

    service.list().subscribe();
    http.expectOne(baseUrl).flush([makeCategory({ id: 'cat-dresses', name: 'Vestidos' })]);
    expect(service.items().map((category) => category.id)).toEqual(['cat-dresses']);
  });
});
