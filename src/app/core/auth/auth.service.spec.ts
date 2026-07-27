import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { makeAuthResponse, makeAuthSession, makeJwt } from '../../../testing/builders';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { AuthSession, LoginOutcome } from './auth.types';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'mbh.token';

describe('AuthService', () => {
  let service: AuthService;
  let sessionState: SessionStateRegistry;
  let http: HttpTestingController;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    sessionState = TestBed.inject(SessionStateRegistry);
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
    expect(service.tenantId()).toBe(session.tenantId);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('clears invalid, expired, claim-mismatched, or tenant-mismatched stored sessions', () => {
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
      JSON.stringify({ ...valid, token: makeJwt({ tenantId: undefined }) }),
    );
    service.restoreSession();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        makeAuthSession({
          tenantId: 'tenant-stored',
          claims: { tenantId: 'tenant-token' },
        }),
      ),
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
    let actual: LoginOutcome | undefined;
    const resetter = vi.fn();
    sessionState.registerResetter(resetter);

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
        tenantId: 'tenant-login',
      }),
    );

    expect(actual?.kind).toBe('authenticated');
    const session = actual?.kind === 'authenticated' ? actual.session : undefined;
    expect(session?.user.role).toBe('Admin');
    expect(session?.tenantId).toBe('tenant-login');
    expect(service.role()).toBe('Admin');
    expect(service.tenantId()).toBe('tenant-login');
    expect(service.token()).toBe(session?.token);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(session);
    expect(resetter).toHaveBeenCalledTimes(1);
  });

  it('keeps an MFA login challenge only in memory and does not authenticate on 202', () => {
    let actual: LoginOutcome | undefined;

    service.login({ email: 'admin@test.com', password: 'secret123' }).subscribe((outcome) => {
      actual = outcome;
    });

    const request = http.expectOne(`${environment.apiBaseUrl}/auth/login`);
    request.flush(
      {
        status: 'MfaRequired',
        challengeToken: 'raw-sensitive-challenge',
        expiresAtUtc: '2026-07-20T18:00:00Z',
      },
      { status: 202, statusText: 'Accepted' },
    );

    expect(actual).toEqual({ kind: 'mfaRequired', expiresAtUtc: '2026-07-20T18:00:00Z' });
    expect(service.isAuthenticated()).toBe(false);
    expect(service.hasPendingMfaChallenge()).toBe(true);
    expect(service.pendingMfaExpiresAtUtc()).toBe('2026-07-20T18:00:00Z');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('verifies an in-memory MFA challenge and persists the resulting normal session', () => {
    service.login({ email: 'admin@test.com', password: 'secret123' }).subscribe();
    http.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(
      {
        status: 'MfaRequired',
        challengeToken: 'challenge-token',
        expiresAtUtc: '2099-07-20T18:00:00Z',
      },
      { status: 202, statusText: 'Accepted' },
    );

    let actual: AuthSession | undefined;
    service.verifyMfa('123456', 'Authenticator').subscribe((session) => (actual = session));

    const request = http.expectOne(`${environment.apiBaseUrl}/auth/mfa/verify`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      challengeToken: 'challenge-token',
      code: '123456',
      method: 'Authenticator',
    });
    request.flush(makeAuthResponse({ tenantId: 'tenant-mfa', role: 'Admin' }));

    expect(actual?.tenantId).toBe('tenant-mfa');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.hasPendingMfaChallenge()).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(actual);
  });

  it('fails closed when login returns a status/body combination outside the contract', () => {
    const error = vi.fn();
    service.login({ email: 'admin@test.com', password: 'secret123' }).subscribe({ error });

    http
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush(
        { status: 'MfaRequired', expiresAtUtc: '2099-07-20T18:00:00Z' },
        { status: 202, statusText: 'Accepted' },
      );

    expect(error).toHaveBeenCalled();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.hasPendingMfaChallenge()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('logs out by clearing the auth session and all registered session state', () => {
    const resetter = vi.fn();
    const session = makeAuthSession();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    service.restoreSession();

    sessionState.registerResetter(resetter);
    service.logout();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(service.session()).toBeNull();
    expect(resetter).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('clears the auth session without navigating', () => {
    const session = makeAuthSession();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    service.restoreSession();

    service.clearSession();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(service.session()).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('requests a password reset with the expected endpoint and payload', () => {
    service.requestPasswordReset('usuario@correo.com').subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/forgot-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'usuario@correo.com' });
    req.flush(null, { status: 202, statusText: 'Accepted' });
  });

  it('resets a forgotten password with the expected endpoint and payload', () => {
    service.resetForgottenPassword('email-token', 'Nueva1234').subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/reset-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'email-token', newPassword: 'Nueva1234' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('maps roles to their home routes', () => {
    expect(service.homePathFor('SuperAdmin')).toBe('/admin');
    expect(service.homePathFor('Admin')).toBe('/admin');
    expect(service.homePathFor('BrandManager')).toBe('/brand-manager');
    expect(service.homePathFor('Seller')).toBe('/seller');
  });
});
