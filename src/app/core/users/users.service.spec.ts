import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { makeUser, paged } from '../../../testing/builders';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let sessionState: SessionStateRegistry;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/users`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UsersService);
    sessionState = TestBed.inject(SessionStateRegistry);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('clears user lists and ignores late responses after session reset', () => {
    const seller = makeUser({ id: 'user-seller', fullName: 'Venta Mostrador' });

    service.list().subscribe();
    const req = http.expectOne((request) => request.url === baseUrl);
    expect(service.loading()).toBe(true);

    sessionState.resetAll();

    expect(service.items()).toEqual([]);
    expect(service.totalCount()).toBe(0);
    expect(service.loading()).toBe(false);

    req.flush(paged([seller], { totalCount: 1 }));

    expect(service.items()).toEqual([]);
    expect(service.totalCount()).toBe(0);
  });
});
