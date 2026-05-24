import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import {
  DEV_TENANT_HOST_STORAGE_KEY,
  TENANT_HOST_HEADER,
  tenantInterceptor,
} from './tenant.interceptor';

describe('tenantInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let originalProduction: boolean;

  beforeEach(() => {
    TestBed.resetTestingModule();
    originalProduction = environment.production;
    environment.production = false;
    localStorage.removeItem(DEV_TENANT_HOST_STORAGE_KEY);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tenantInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.removeItem(DEV_TENANT_HOST_STORAGE_KEY);
    environment.production = originalProduction;
  });

  it('does not attach X-Tenant-Host when no local dev override exists', () => {
    http.get(`${environment.apiBaseUrl}/products`).subscribe();

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/products`);
    expect(req.request.headers.has(TENANT_HOST_HEADER)).toBe(false);
    req.flush({});
  });

  it('attaches the local dev tenant host override to API requests', () => {
    localStorage.setItem(DEV_TENANT_HOST_STORAGE_KEY, 'aurora.localhost');

    http.get(`${environment.apiBaseUrl}/products`).subscribe();

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/products`);
    expect(req.request.headers.get(TENANT_HOST_HEADER)).toBe('aurora.localhost');
    req.flush({});
  });

  it('never attaches X-Tenant-Host in production', () => {
    environment.production = true;
    localStorage.setItem(DEV_TENANT_HOST_STORAGE_KEY, 'aurora.localhost');

    http.get(`${environment.apiBaseUrl}/products`).subscribe();

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/products`);
    expect(req.request.headers.has(TENANT_HOST_HEADER)).toBe(false);
    req.flush({});
  });

  it('does not attach X-Tenant-Host to non-API requests', () => {
    localStorage.setItem(DEV_TENANT_HOST_STORAGE_KEY, 'aurora.localhost');

    http.get('/assets/config.json').subscribe();

    const req = httpTesting.expectOne('/assets/config.json');
    expect(req.request.headers.has(TENANT_HOST_HEADER)).toBe(false);
    req.flush({});
  });
});
