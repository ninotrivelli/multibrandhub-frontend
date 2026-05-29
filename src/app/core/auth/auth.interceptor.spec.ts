import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let token: string | null;

  beforeEach(() => {
    TestBed.resetTestingModule();
    token = 'jwt-token';
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { token: () => token } },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('attaches bearer tokens to authenticated non-login requests', () => {
    http.get('/api/products').subscribe();

    const req = httpTesting.expectOne('/api/products');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush({});
  });

  it('does not attach bearer tokens to login or anonymous requests', () => {
    http.post('/api/auth/login', {}).subscribe();
    let req = httpTesting.expectOne('/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});

    token = null;
    http.get('/api/products').subscribe();
    req = httpTesting.expectOne('/api/products');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
