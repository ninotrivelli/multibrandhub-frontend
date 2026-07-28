import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { makeUser, paged } from '../../../testing/builders';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { HANDLE_ERROR_LOCALLY } from '../http/local-error-handling';
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

  it('resets MFA with nullable factor fields and local dialog error handling', () => {
    const body = {
      currentPassword: 'Password!123',
      verificationCode: null,
      method: null,
      reason: 'El administrador perdió su dispositivo corporativo.',
    };

    service.resetMfa('admin-id', body).subscribe();

    const request = http.expectOne(`${baseUrl}/admin-id/mfa/reset`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(request.request.context.get(HANDLE_ERROR_LOCALLY)).toBe(true);
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('lists, reads, creates, updates, deactivates, resets, and deletes users', () => {
    const first = makeUser({ id: 'user-1', fullName: 'Primera Persona', isActive: true });
    const second = makeUser({ id: 'user-2', fullName: 'Segunda Persona', isActive: true });

    service.list({ page: 2, pageSize: 20 }).subscribe();
    const list = http.expectOne(
      (request) =>
        request.url === baseUrl &&
        request.params.get('page') === '2' &&
        request.params.get('pageSize') === '20',
    );
    list.flush(paged([first, second], { page: 2, pageSize: 20, totalCount: 2 }));
    expect(service.items()).toEqual([first, second]);
    expect(service.totalCount()).toBe(2);
    expect(service.hasItems()).toBe(true);

    service.getById(first.id).subscribe((user) => expect(user).toEqual(first));
    http.expectOne(`${baseUrl}/${first.id}`).flush(first);

    const createBody = {
      fullName: 'Nueva Persona',
      email: 'nueva@example.com',
      password: 'Password!123',
      role: 'Seller' as const,
      brandId: null,
    };
    const created = makeUser({ id: 'user-created', ...createBody });
    service.create(createBody).subscribe();
    const create = http.expectOne(baseUrl);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(createBody);
    create.flush(created);
    expect(service.items()[0]).toEqual(created);

    const updateBody = {
      fullName: 'Primera Actualizada',
      email: first.email,
      role: first.role,
      isActive: true,
      brandId: first.brandId,
    };
    const updated = { ...first, ...updateBody };
    service.update(first.id, updateBody).subscribe();
    const update = http.expectOne(`${baseUrl}/${first.id}`);
    expect(update.request.method).toBe('PUT');
    update.flush(updated);
    expect(service.items().find((user) => user.id === first.id)).toEqual(updated);

    service.deactivate(first.id).subscribe();
    const deactivate = http.expectOne(`${baseUrl}/${first.id}/deactivate`);
    expect(deactivate.request.method).toBe('PATCH');
    deactivate.flush(null);
    expect(service.items().find((user) => user.id === first.id)?.isActive).toBe(false);

    service.resetPassword(second.id, 'AnotherPassword!123').subscribe();
    const password = http.expectOne(`${baseUrl}/${second.id}/password`);
    expect(password.request.method).toBe('PATCH');
    expect(password.request.body).toEqual({ newPassword: 'AnotherPassword!123' });
    password.flush(null);

    service.delete(second.id).subscribe();
    const remove = http.expectOne(`${baseUrl}/${second.id}`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    expect(service.items().some((user) => user.id === second.id)).toBe(false);
  });

  it('stops loading after a current-session list error', () => {
    service.list().subscribe({ error: () => undefined });
    const request = http.expectOne((candidate) => candidate.url === baseUrl);
    expect(service.loading()).toBe(true);
    request.flush('error', { status: 500, statusText: 'Server Error' });
    expect(service.loading()).toBe(false);
  });
});
