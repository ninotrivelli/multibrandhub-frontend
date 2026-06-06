import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { makeBrand, paged } from '../../../testing/builders';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { BrandsService } from './brands.service';

describe('BrandsService', () => {
  let service: BrandsService;
  let sessionState: SessionStateRegistry;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/brands`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BrandsService);
    sessionState = TestBed.inject(SessionStateRegistry);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('clears cached brands on session reset', () => {
    const lumina = makeBrand({ id: 'brand-lumina', name: 'Lumina' });

    service.list().subscribe();
    http.expectOne((request) => request.url === baseUrl).flush(paged([lumina]));

    expect(service.items()).toEqual([lumina]);
    expect(service.hasItems()).toBe(true);

    sessionState.resetAll();

    expect(service.items()).toEqual([]);
    expect(service.totalCount()).toBe(0);
    expect(service.loading()).toBe(false);
    expect(service.hasItems()).toBe(false);
  });

  it('ignores late responses from a previous session generation', () => {
    const lumina = makeBrand({ id: 'brand-lumina', name: 'Lumina' });

    service.list().subscribe();
    const req = http.expectOne((request) => request.url === baseUrl);
    expect(service.loading()).toBe(true);

    sessionState.resetAll();
    expect(service.loading()).toBe(false);

    req.flush(paged([lumina]));

    expect(service.items()).toEqual([]);
    expect(service.totalCount()).toBe(0);
    expect(service.loading()).toBe(false);
  });
});
