import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { makeAuthResponse, makeAuthSession, makeJwt } from '../../../testing/builders';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import {
  AuthSession,
  EMAIL_CLAIM_URI,
  LoginOutcome,
  NAMEID_CLAIM_URI,
  ROLE_CLAIM_URI,
  UserRole,
} from './auth.types';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'mbh.token';

describe('AuthService', () => {
  let service: AuthService;
  let sessionState: SessionStateRegistry;
  let http: HttpTestingController;
  let router: {
    navigate: ReturnType<typeof vi.fn>;
    navigateByUrl: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    router = {
      navigate: vi.fn(),
      navigateByUrl: vi.fn(() => Promise.resolve(true)),
    };
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
    expect(router.navigateByUrl).not.toHaveBeenCalled();
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

  it('ignores absent storage and clears malformed JWTs or tokens without numeric expiry', () => {
    service.restoreSession();
    expect(service.session()).toBeNull();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...makeAuthSession(), token: 'not-a-jwt' }));
    service.restoreSession();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...makeAuthSession(), token: makeJwt({ exp: undefined }) }),
    );
    service.restoreSession();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('rejects every user claim mismatch, missing role, and unknown numeric role', () => {
    const session = makeAuthSession();
    const mismatchedTokens = [
      makeJwt({ sub: 'other-user' }),
      makeJwt({ email: 'other@test.com' }),
      makeJwt({ role: 'Seller' }),
      makeJwt({ role: undefined }),
      makeJwt({ role: 99 as never }),
      makeJwt({ brandId: 'other-brand' }),
    ];

    for (const token of mismatchedTokens) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, token }));
      service.restoreSession();
      expect(service.session()).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    }
  });

  it('restores tokens using array and full-URI identity claims', () => {
    const session = makeAuthSession();
    const token = makeJwt({
      sub: undefined,
      nameid: undefined,
      email: undefined,
      role: undefined,
      [NAMEID_CLAIM_URI]: ['user-admin'],
      [EMAIL_CLAIM_URI]: ['admin@local.test'],
      [ROLE_CLAIM_URI]: ['Admin'],
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, token }));

    service.restoreSession();

    expect(service.session()?.user.userId).toBe('user-admin');
    expect(service.role()).toBe('Admin');
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

  it('rejects each malformed authenticated login field', () => {
    const valid = makeAuthResponse();
    const malformedBodies: Array<object | null> = [
      null,
      { ...valid, userId: 123 },
      { ...valid, fullName: null },
      { ...valid, email: false },
      { ...valid, role: 'Owner' },
      { ...valid, brandId: undefined },
      { ...valid, token: '' },
      { ...valid, expiresAtUtc: 123 },
    ];

    for (const body of malformedBodies) {
      const error = vi.fn();
      service.login({ email: 'admin@test.com', password: 'secret123' }).subscribe({ error });
      http.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(body);
      expect(error).toHaveBeenCalledTimes(1);
    }
  });

  it('rejects malformed MFA challenge fields', () => {
    const malformedBodies: object[] = [
      { status: 'Other', challengeToken: 'token', expiresAtUtc: '2099-01-01T00:00:00Z' },
      { status: 'MfaRequired', challengeToken: '', expiresAtUtc: '2099-01-01T00:00:00Z' },
      { status: 'MfaRequired', challengeToken: 'token', expiresAtUtc: 123 },
    ];

    for (const body of malformedBodies) {
      const error = vi.fn();
      service.login({ email: 'admin@test.com', password: 'secret123' }).subscribe({ error });
      http
        .expectOne(`${environment.apiBaseUrl}/auth/login`)
        .flush(body, { status: 202, statusText: 'Accepted' });
      expect(error).toHaveBeenCalledTimes(1);
    }
  });

  it('fails MFA verification without a pending challenge or with a malformed response', () => {
    const missingChallengeError = vi.fn();
    service.verifyMfa('123456', 'Authenticator').subscribe({ error: missingChallengeError });
    expect(missingChallengeError).toHaveBeenCalledWith(expect.any(Error));

    service.login({ email: 'admin@test.com', password: 'secret123' }).subscribe();
    http.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(
      {
        status: 'MfaRequired',
        challengeToken: 'challenge-token',
        expiresAtUtc: '2099-07-20T18:00:00Z',
      },
      { status: 202, statusText: 'Accepted' },
    );
    const malformedResponseError = vi.fn();
    service.verifyMfa('123456', 'Authenticator').subscribe({ error: malformedResponseError });
    http.expectOne(`${environment.apiBaseUrl}/auth/mfa/verify`).flush({ token: '' });
    expect(malformedResponseError).toHaveBeenCalledTimes(1);
    expect(service.hasPendingMfaChallenge()).toBe(true);
  });

  it('fails authenticated mapping when the JWT omits tenantId', () => {
    const error = vi.fn();
    const response = makeAuthResponse();
    service.login({ email: 'admin@test.com', password: 'secret123' }).subscribe({ error });

    http
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({ ...response, token: makeJwt({ tenantId: undefined }) });

    expect(error).toHaveBeenCalledWith(expect.any(Error));
    expect(service.session()).toBeNull();
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

  it('replaces the session from another tab, clears pending MFA, resets state, and redirects', () => {
    const current = makeAuthSession();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    service.restoreSession();

    service.login({ email: 'manager@test.com', password: 'secret123' }).subscribe();
    http.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(
      {
        status: 'MfaRequired',
        challengeToken: 'pending-challenge',
        expiresAtUtc: '2099-07-20T18:00:00Z',
      },
      { status: 202, statusText: 'Accepted' },
    );

    const resetter = vi.fn();
    sessionState.registerResetter(resetter);
    const replacement = makeAuthSession({
      user: {
        userId: 'user-manager',
        fullName: 'Marca Manager',
        email: 'manager@test.com',
        role: 'BrandManager',
        brandId: 'brand-managed',
      },
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(replacement));

    dispatchStorageEvent(STORAGE_KEY, localStorage);

    expect(service.session()).toEqual(replacement);
    expect(service.role()).toBe('BrandManager');
    expect(service.hasPendingMfaChallenge()).toBe(false);
    expect(resetter).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/brand-manager', { replaceUrl: true });
  });

  it('clears the session when another tab removes the auth key or clears localStorage', () => {
    const resetter = vi.fn();
    sessionState.registerResetter(resetter);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeAuthSession()));
    service.restoreSession();
    resetter.mockClear();
    localStorage.removeItem(STORAGE_KEY);

    dispatchStorageEvent(STORAGE_KEY, localStorage);

    expect(service.session()).toBeNull();
    expect(resetter).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenLastCalledWith('/login', { replaceUrl: true });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeAuthSession()));
    service.restoreSession();
    resetter.mockClear();
    router.navigateByUrl.mockClear();
    localStorage.clear();

    dispatchStorageEvent(null, localStorage);

    expect(service.session()).toBeNull();
    expect(resetter).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('fails closed for malformed, expired, or claim-mismatched sessions from another tab', () => {
    const valid = makeAuthSession();
    const invalidValues = [
      'not-json',
      JSON.stringify({ token: 'missing-session-fields' }),
      JSON.stringify({
        ...valid,
        token: makeJwt({ exp: Math.floor(Date.now() / 1000) - 1 }),
      }),
      JSON.stringify({
        ...valid,
        user: { ...valid.user, email: 'tampered@test.com' },
      }),
    ];

    for (const invalidValue of invalidValues) {
      localStorage.setItem(STORAGE_KEY, invalidValue);
      dispatchStorageEvent(STORAGE_KEY, localStorage);

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(service.session()).toBeNull();
      expect(router.navigateByUrl).toHaveBeenLastCalledWith('/login', { replaceUrl: true });
    }
  });

  it('ignores unrelated localStorage changes and auth-key changes in sessionStorage', () => {
    const current = makeAuthSession();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    service.restoreSession();
    const resetter = vi.fn();
    sessionState.registerResetter(resetter);

    localStorage.setItem('unrelated-key', 'value');
    dispatchStorageEvent('unrelated-key', localStorage);
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(makeAuthSession({ user: { role: 'Seller' } })),
    );
    dispatchStorageEvent(STORAGE_KEY, sessionStorage);

    expect(service.session()).toEqual(current);
    expect(resetter).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
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
    expect(service.homePathFor('Unknown' as UserRole)).toBe('/login');
  });
});

function dispatchStorageEvent(key: string | null, storageArea: Storage): void {
  window.dispatchEvent(new StorageEvent('storage', { key, storageArea }));
}
