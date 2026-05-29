import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notifications/notification.service';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let auth: { logout: ReturnType<typeof vi.fn> };
  let notifications: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    auth = { logout: vi.fn() };
    notifications = { warn: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: notifications },
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lets login errors be handled by the login component', () => {
    http.post('/api/auth/login', {}).subscribe({ error: () => {} });

    httpTesting.expectOne('/api/auth/login').flush(
      { message: 'Invalid credentials' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(auth.logout).not.toHaveBeenCalled();
    expect(notifications.warn).not.toHaveBeenCalled();
    expect(notifications.error).not.toHaveBeenCalled();
  });

  it('logs out and warns when a non-login request returns 401', () => {
    http.get('/api/products').subscribe({ error: () => {} });

    httpTesting.expectOne('/api/products').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(notifications.warn).toHaveBeenCalledWith('Volvé a ingresar', 'Sesión expirada');
    expect(auth.logout).toHaveBeenCalled();
  });

  it('surfaces validation, permission, and generic backend errors', () => {
    http.post('/api/products', {}).subscribe({ error: () => {} });
    httpTesting.expectOne('/api/products').flush(
      { errors: [{ property: 'name', message: 'Nombre requerido' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(notifications.error).toHaveBeenCalledWith('Nombre requerido', 'Datos inválidos');

    http.delete('/api/users/user-admin').subscribe({ error: () => {} });
    httpTesting.expectOne('/api/users/user-admin').flush(
      { message: 'No podés eliminar este usuario.' },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(notifications.error).toHaveBeenCalledWith(
      'No podés eliminar este usuario.',
      'Acción no permitida',
    );
    expect(auth.logout).not.toHaveBeenCalled();

    http.get('/api/reports').subscribe({ error: () => {} });
    httpTesting.expectOne('/api/reports').flush(
      { message: 'Servidor no disponible' },
      { status: 500, statusText: 'Server Error' },
    );
    expect(notifications.error).toHaveBeenCalledWith('Servidor no disponible');
  });

  it('logs out and warns when a 403 means the session is no longer valid for the tenant', () => {
    http.get('/api/products').subscribe({ error: () => {} });

    httpTesting.expectOne('/api/products').flush(
      { message: 'El token no corresponde al local actual.' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(notifications.warn).toHaveBeenCalledWith('Volvé a ingresar', 'Sesión no vigente');
    expect(auth.logout).toHaveBeenCalled();
    expect(notifications.error).not.toHaveBeenCalled();
  });
});
