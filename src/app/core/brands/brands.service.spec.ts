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

  it('lists archived brands and supports the complete brand lifecycle', () => {
    const first = makeBrand({ id: 'brand-1', name: 'Primera' });
    const second = makeBrand({ id: 'brand-2', name: 'Segunda' });

    service.list({ page: 2, pageSize: 25, includeArchived: true }).subscribe();
    const list = http.expectOne(
      (request) =>
        request.url === baseUrl &&
        request.params.get('page') === '2' &&
        request.params.get('pageSize') === '25' &&
        request.params.get('includeArchived') === 'true',
    );
    list.flush(paged([first, second], { page: 2, pageSize: 25, totalCount: 2 }));
    expect(service.items()).toEqual([first, second]);

    service.getById(first.id).subscribe((brand) => expect(brand).toEqual(first));
    http.expectOne(`${baseUrl}/${first.id}`).flush(first);

    const createBody = {
      name: 'Nueva Marca',
      code: 'NUEVA',
      logoUrl: null,
      contactEmail: 'marca@example.com',
      contractType: 'CommissionOnly' as const,
      commissionPercentage: 20,
      fixedRentCost: 0,
    };
    const created = makeBrand({ id: 'brand-created', ...createBody });
    service.create(createBody).subscribe();
    const create = http.expectOne(baseUrl);
    expect(create.request.method).toBe('POST');
    create.flush(created);
    expect(service.items()[0]).toEqual(created);

    const updateBody = {
      name: 'Primera Actualizada',
      logoUrl: null,
      contactEmail: first.contactEmail,
      contractType: first.contractType,
      commissionPercentage: first.commissionPercentage,
      fixedRentCost: first.fixedRentCost,
    };
    const updated = { ...first, ...updateBody };
    service.update(first.id, updateBody).subscribe();
    const update = http.expectOne(`${baseUrl}/${first.id}`);
    expect(update.request.method).toBe('PUT');
    update.flush(updated);
    expect(service.items().find((brand) => brand.id === first.id)).toEqual(updated);

    service.offboard(first.id).subscribe();
    const offboard = http.expectOne(`${baseUrl}/${first.id}/offboard`);
    expect(offboard.request.method).toBe('POST');
    expect(offboard.request.body).toBeNull();
    offboard.flush({
      brandId: first.id,
      brandName: first.name,
      status: 'Archived',
      archivedAtUtc: '2026-07-27T18:00:00Z',
      productsArchived: 3,
      usersDeactivated: 1,
    });
    expect(service.items().find((brand) => brand.id === first.id)?.status).toBe('Archived');

    service.delete(second.id).subscribe();
    const remove = http.expectOne(`${baseUrl}/${second.id}`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    expect(service.items().some((brand) => brand.id === second.id)).toBe(false);
  });

  it('stops loading after a current-session list error', () => {
    service.list().subscribe({ error: () => undefined });
    const request = http.expectOne((candidate) => candidate.url === baseUrl);
    expect(service.loading()).toBe(true);
    request.flush('error', { status: 500, statusText: 'Server Error' });
    expect(service.loading()).toBe(false);
  });
});
