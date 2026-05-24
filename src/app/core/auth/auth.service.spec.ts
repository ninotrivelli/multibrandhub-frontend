import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { makeAuthResponse, makeAuthSession, makeJwt } from '../../../testing/builders';
import { AuthSession } from './auth.types';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'mbh.token';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('restores a valid non-expired session whose stored user matches JWT claims', () => {
    const session = makeAuthSession({
      user: { userId: 'user-1', email: 'admin@test.com', role: 'Admin', brandId: 'brand-own' },
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

    service.restoreSession();

    expect(service.session()).toEqual(session);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('clears invalid, expired, or claim-mismatched stored sessions', () => {
    const valid = makeAuthSession();

    localStorage.setItem(STORAGE_KEY, 'not-json');
    service.restoreSession();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...valid, token: makeJwt({ exp: Math.floor(Date.now() / 1000) - 1 }) }),
    );
    service.restoreSession();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...valid,
        user: { ...valid.user, email: 'tampered@test.com' },
      }),
    );
    service.restoreSession();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(service.session()).toBeNull();
  });

  it('logs in, normalizes numeric roles, stores the session, and exposes computed state', () => {
    let actual: AuthSession | undefined;

    service.login({ email: 'admin@test.com', password: 'secret123' }).subscribe((session) => {
      actual = session;
    });

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'admin@test.com', password: 'secret123' });

    req.flush(
      makeAuthResponse({
        userId: 'user-admin',
        email: 'admin@test.com',
        role: 2,
        brandId: 'brand-own',
      }),
    );

    expect(actual?.user.role).toBe('Admin');
    expect(service.role()).toBe('Admin');
    expect(service.token()).toBe(actual?.token);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(actual);
  });

  it('maps roles to their home routes', () => {
    expect(service.homePathFor('SuperAdmin')).toBe('/admin');
    expect(service.homePathFor('Admin')).toBe('/admin');
    expect(service.homePathFor('BrandManager')).toBe('/brand-manager');
    expect(service.homePathFor('Seller')).toBe('/seller');
  });
});
