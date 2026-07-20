import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notifications/notification.service';
import { errorInterceptor } from './error.interceptor';
import { HANDLE_ERROR_LOCALLY } from './local-error-handling';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let authenticated: boolean;
  let auth: {
    logout: ReturnType<typeof vi.fn>;
    isAuthenticated: () => boolean;
  };
  let notifications: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    authenticated = true;
    auth = {
      logout: vi.fn(() => {
        authenticated = false;
      }),
      isAuthenticated: () => authenticated,
    };
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

  it('lets public auth errors be handled by their components', () => {
    for (const path of [
      '/api/auth/login',
      '/api/auth/mfa/verify',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
    ]) {
      http
        .post(path, {}, { context: new HttpContext().set(HANDLE_ERROR_LOCALLY, true) })
        .subscribe({ error: () => {} });

      httpTesting
        .expectOne(path)
        .flush(
          { message: 'Error administrado por la pantalla' },
          { status: 429, statusText: 'Too Many Requests' },
        );
    }

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
    httpTesting
      .expectOne('/api/products')
      .flush(
        { errors: [{ property: 'name', message: 'Nombre requerido' }] },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(notifications.error).toHaveBeenCalledWith('Nombre requerido', 'Datos inválidos');

    http.delete('/api/users/user-admin').subscribe({ error: () => {} });
    httpTesting
      .expectOne('/api/users/user-admin')
      .flush(
        { message: 'No podés eliminar este usuario.' },
        { status: 403, statusText: 'Forbidden' },
      );
    expect(notifications.error).toHaveBeenCalledWith(
      'No podés eliminar este usuario.',
      'Acción no permitida',
    );
    expect(auth.logout).not.toHaveBeenCalled();

    http.get('/api/reports').subscribe({ error: () => {} });
    httpTesting
      .expectOne('/api/reports')
      .flush({ message: 'Servidor no disponible' }, { status: 500, statusText: 'Server Error' });
    expect(notifications.error).toHaveBeenCalledWith('Servidor no disponible');
  });

  it('logs out and warns when a 403 carries the session_invalid code', () => {
    http.get('/api/products').subscribe({ error: () => {} });

    // Message intentionally NOT in the legacy string set: the code alone
    // must trigger the session clear, regardless of backend copy.
    httpTesting
      .expectOne('/api/products')
      .flush(
        { message: 'Cualquier texto que el backend quiera mostrar.', code: 'session_invalid' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(notifications.warn).toHaveBeenCalledWith('Volvé a ingresar', 'Sesión no vigente');
    expect(auth.logout).toHaveBeenCalled();
    expect(notifications.error).not.toHaveBeenCalled();
  });

  it('still handles session-invalid errors globally for locally handled MFA forms', () => {
    http
      .post(
        '/api/auth/mfa/disable',
        {},
        {
          context: new HttpContext().set(HANDLE_ERROR_LOCALLY, true),
        },
      )
      .subscribe({ error: () => {} });

    httpTesting
      .expectOne('/api/auth/mfa/disable')
      .flush(
        {
          message: 'La sesión no tiene autenticación en dos pasos válida.',
          code: 'session_invalid',
        },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(notifications.warn).toHaveBeenCalledWith('Volvé a ingresar', 'Sesión no vigente');
  });

  it('deduplicates invalid-session notifications after the first response clears auth state', () => {
    http.get('/api/one').subscribe({ error: () => {} });
    http.get('/api/two').subscribe({ error: () => {} });

    httpTesting
      .expectOne('/api/one')
      .flush({ code: 'session_invalid' }, { status: 403, statusText: 'Forbidden' });
    httpTesting
      .expectOne('/api/two')
      .flush({ code: 'session_invalid' }, { status: 403, statusText: 'Forbidden' });

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(notifications.warn).toHaveBeenCalledTimes(1);
  });

  it('still logs out on legacy session-invalid 403s that only carry the known message', () => {
    http.get('/api/products').subscribe({ error: () => {} });

    httpTesting
      .expectOne('/api/products')
      .flush(
        { message: 'El token no corresponde al local actual.' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(notifications.warn).toHaveBeenCalledWith('Volvé a ingresar', 'Sesión no vigente');
    expect(auth.logout).toHaveBeenCalled();
    expect(notifications.error).not.toHaveBeenCalled();
  });

  it('recognizes the stale auth version message as a legacy session-invalid response', () => {
    http.get('/api/products').subscribe({ error: () => {} });

    httpTesting
      .expectOne('/api/products')
      .flush(
        { message: 'La sesión dejó de estar vigente.' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(notifications.warn).toHaveBeenCalledWith('Volvé a ingresar', 'Sesión no vigente');
    expect(auth.logout).toHaveBeenCalled();
  });
});
