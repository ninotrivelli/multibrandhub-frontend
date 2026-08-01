import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, filter, fromEvent, map, tap, throwError } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

import { environment } from '../../../environments/environment';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { HANDLE_ERROR_LOCALLY } from '../http/local-error-handling';
import {
  AuthResponse,
  AuthSession,
  AuthUser,
  CompletePasswordResetRequest,
  EMAIL_CLAIM_URI,
  ForgotPasswordRequest,
  JwtClaims,
  LoginRequest,
  LoginOutcome,
  MfaChallengeResponse,
  MfaVerificationMethod,
  NAMEID_CLAIM_URI,
  ROLE_CLAIM_URI,
  RoleWire,
  UserRole,
  VerifyMfaRequest,
} from './auth.types';

const STORAGE_KEY = 'mbh.token';

const ROLE_BY_INT: Record<number, UserRole> = {
  1: 'SuperAdmin',
  2: 'Admin',
  3: 'BrandManager',
  4: 'Seller',
};

function normalizeRole(r: RoleWire): UserRole {
  if (typeof r === 'number') {
    const role = ROLE_BY_INT[r];
    if (!role) throw new Error(`Unknown role value from API: ${r}`);
    return role;
  }
  return r;
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function claimsMatchSession(claims: JwtClaims, session: AuthSession): boolean {
  const { user } = session;
  if (!claims.tenantId || claims.tenantId !== session.tenantId) return false;

  const claimSub =
    claims.sub ?? firstString(claims.nameid) ?? firstString(claims[NAMEID_CLAIM_URI]);
  if (claimSub !== user.userId) return false;

  const claimEmail = firstString(claims.email) ?? firstString(claims[EMAIL_CLAIM_URI]);
  if (claimEmail !== user.email) return false;

  // ClaimTypes.Role is NOT in the OutboundClaimTypeMap, so the JWT carries
  // it under the full URI (ROLE_CLAIM_URI). Older tokens or other backends
  // may still use the short "role" form.
  const rawRole = firstString(claims.role) ?? firstString(claims[ROLE_CLAIM_URI]);
  if (!rawRole) return false;
  try {
    const claimRole = normalizeRole(rawRole as RoleWire);
    if (claimRole !== user.role) return false;
  } catch {
    return false;
  }

  const claimBrand = claims.brandId ?? null;
  if (claimBrand !== user.brandId) return false;

  return true;
}

function tenantIdFromToken(token: string): string {
  const claims = jwtDecode<JwtClaims>(token);
  if (!claims.tenantId) {
    throw new Error('JWT tenantId claim is missing.');
  }
  return claims.tenantId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRoleWire(value: unknown): value is RoleWire {
  return (
    value === 'SuperAdmin' ||
    value === 'Admin' ||
    value === 'BrandManager' ||
    value === 'Seller' ||
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4
  );
}

function isUserRole(value: unknown): value is UserRole {
  return (
    value === 'SuperAdmin' || value === 'Admin' || value === 'BrandManager' || value === 'Seller'
  );
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value) || !isRecord(value['user'])) return false;

  const user = value['user'];
  return (
    typeof user['userId'] === 'string' &&
    typeof user['fullName'] === 'string' &&
    typeof user['email'] === 'string' &&
    isUserRole(user['role']) &&
    (typeof user['brandId'] === 'string' || user['brandId'] === null) &&
    typeof value['tenantId'] === 'string' &&
    value['tenantId'].length > 0 &&
    typeof value['token'] === 'string' &&
    value['token'].length > 0 &&
    typeof value['expiresAtUtc'] === 'string'
  );
}

function isAuthResponse(value: unknown): value is AuthResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value['userId'] === 'string' &&
    typeof value['fullName'] === 'string' &&
    typeof value['email'] === 'string' &&
    isRoleWire(value['role']) &&
    (typeof value['brandId'] === 'string' || value['brandId'] === null) &&
    typeof value['token'] === 'string' &&
    value['token'].length > 0 &&
    typeof value['expiresAtUtc'] === 'string'
  );
}

function isMfaChallengeResponse(value: unknown): value is MfaChallengeResponse {
  if (!isRecord(value)) return false;
  return (
    value['status'] === 'MfaRequired' &&
    typeof value['challengeToken'] === 'string' &&
    value['challengeToken'].length > 0 &&
    typeof value['expiresAtUtc'] === 'string'
  );
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly sessionState = inject(SessionStateRegistry);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _session = signal<AuthSession | null>(null);
  private readonly _pendingMfaChallenge = signal<MfaChallengeResponse | null>(null);

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly token = computed(() => this._session()?.token ?? null);
  readonly tenantId = computed(() => this._session()?.tenantId ?? null);
  readonly role = computed<UserRole | null>(() => this._session()?.user.role ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly pendingMfaExpiresAtUtc = computed(
    () => this._pendingMfaChallenge()?.expiresAtUtc ?? null,
  );
  readonly hasPendingMfaChallenge = computed(() => this._pendingMfaChallenge() !== null);

  constructor() {
    fromEvent<StorageEvent>(window, 'storage')
      .pipe(
        filter(
          (event) =>
            event.storageArea === localStorage && (event.key === STORAGE_KEY || event.key === null),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.syncSessionFromStorage());
  }

  restoreSession(): void {
    this.clearPendingMfaChallenge();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const session = this.parseStoredSession(raw);
    if (!session) {
      this.clearSession();
      return;
    }

    this.replaceSessionState(session);
  }

  login(req: LoginRequest): Observable<LoginOutcome> {
    this.clearPendingMfaChallenge();

    return this.http
      .post<unknown>(`${environment.apiBaseUrl}/auth/login`, req, {
        context: this.localErrorContext(),
        observe: 'response',
      })
      .pipe(
        map((response) => this.mapLoginResponse(response)),
        tap((outcome) => {
          if (outcome.kind === 'authenticated') {
            this.persistSession(outcome.session);
          }
        }),
      );
  }

  verifyMfa(code: string, method: MfaVerificationMethod): Observable<AuthSession> {
    const challenge = this._pendingMfaChallenge();
    if (!challenge) {
      return throwError(() => new Error('MFA challenge is not available.'));
    }

    const body: VerifyMfaRequest = {
      challengeToken: challenge.challengeToken,
      code,
      method,
    };

    return this.http
      .post<unknown>(`${environment.apiBaseUrl}/auth/mfa/verify`, body, {
        context: this.localErrorContext(),
      })
      .pipe(
        map((response) => {
          if (!isAuthResponse(response)) {
            throw new Error('Unexpected MFA verification response contract.');
          }
          return this.mapAuthResponse(response);
        }),
        tap((session) => {
          this.clearPendingMfaChallenge();
          this.persistSession(session);
        }),
      );
  }

  clearPendingMfaChallenge(): void {
    this._pendingMfaChallenge.set(null);
  }

  requestPasswordReset(email: string): Observable<void> {
    const body: ForgotPasswordRequest = { email };
    return this.http.post<void>(`${environment.apiBaseUrl}/auth/forgot-password`, body, {
      context: this.localErrorContext(),
    });
  }

  resetForgottenPassword(token: string, newPassword: string): Observable<void> {
    const body: CompletePasswordResetRequest = { token, newPassword };
    return this.http.post<void>(`${environment.apiBaseUrl}/auth/reset-password`, body, {
      context: this.localErrorContext(),
    });
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._session.set(null);
    this.clearPendingMfaChallenge();
    this.sessionState.resetAll();
  }

  private localErrorContext(): HttpContext {
    return new HttpContext().set(HANDLE_ERROR_LOCALLY, true);
  }

  private mapLoginResponse(response: HttpResponse<unknown>): LoginOutcome {
    if (response.status === 200 && isAuthResponse(response.body)) {
      return { kind: 'authenticated', session: this.mapAuthResponse(response.body) };
    }

    if (response.status === 202 && isMfaChallengeResponse(response.body)) {
      this._pendingMfaChallenge.set(response.body);
      return { kind: 'mfaRequired', expiresAtUtc: response.body.expiresAtUtc };
    }

    throw new Error('Unexpected login response contract.');
  }

  private mapAuthResponse(response: AuthResponse): AuthSession {
    return {
      user: {
        userId: response.userId,
        fullName: response.fullName,
        email: response.email,
        role: normalizeRole(response.role),
        brandId: response.brandId,
      },
      tenantId: tenantIdFromToken(response.token),
      token: response.token,
      expiresAtUtc: response.expiresAtUtc,
    };
  }

  private persistSession(session: AuthSession): void {
    this.sessionState.resetAll();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this._session.set(session);
  }

  private syncSessionFromStorage(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    const session = raw ? this.parseStoredSession(raw) : null;

    if (!session) {
      this.clearSession();
      void this.router.navigateByUrl('/login', { replaceUrl: true });
      return;
    }

    this.replaceSessionState(session);
    void this.router.navigateByUrl(this.homePathFor(session.user.role), { replaceUrl: true });
  }

  private parseStoredSession(raw: string): AuthSession | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!isAuthSession(parsed)) return null;

    let claims: JwtClaims;
    try {
      claims = jwtDecode<JwtClaims>(parsed.token);
    } catch {
      return null;
    }

    // Use the JWT's own `exp` claim as the source of truth, not the
    // separately-stored expiresAtUtc (which a tamperer could rewrite).
    const expMs = typeof claims.exp === 'number' ? claims.exp * 1000 : 0;
    if (expMs <= Date.now()) return null;

    return claimsMatchSession(claims, parsed) ? parsed : null;
  }

  private replaceSessionState(session: AuthSession): void {
    this.clearPendingMfaChallenge();
    this.sessionState.resetAll();
    this._session.set(session);
  }

  homePathFor(role: UserRole): string {
    switch (role) {
      case 'SuperAdmin':
      case 'Admin':
        return '/admin';
      case 'BrandManager':
        return '/brand-manager';
      case 'Seller':
        return '/seller';
      default: {
        const _exhaustive: never = role;
        return '/login';
      }
    }
  }
}
