import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
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

  it('attaches bearer tokens to authenticated API requests', () => {
    http.get(`${environment.apiBaseUrl}/products`).subscribe();

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/products`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush({});
  });

  it('does not attach bearer tokens to public auth endpoints or anonymous requests', () => {
    for (const path of ['/auth/login', '/auth/forgot-password', '/auth/reset-password']) {
      const url = `${environment.apiBaseUrl}${path}`;
      http.post(url, {}).subscribe();
      const req = httpTesting.expectOne(url);
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    }

    token = null;
    http.get(`${environment.apiBaseUrl}/products`).subscribe();
    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/products`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('never attaches bearer tokens to non-API requests', () => {
    http.get('https://images.example.com/product.png').subscribe();
    let req = httpTesting.expectOne('https://images.example.com/product.png');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});

    http.get('/assets/config.json').subscribe();
    req = httpTesting.expectOne('/assets/config.json');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
