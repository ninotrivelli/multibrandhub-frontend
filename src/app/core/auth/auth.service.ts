import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
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
  NAMEID_CLAIM_URI,
  ROLE_CLAIM_URI,
  RoleWire,
  UserRole,
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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly sessionState = inject(SessionStateRegistry);

  private readonly _session = signal<AuthSession | null>(null);

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly token = computed(() => this._session()?.token ?? null);
  readonly tenantId = computed(() => this._session()?.tenantId ?? null);
  readonly role = computed<UserRole | null>(() => this._session()?.user.role ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);

  restoreSession(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    let parsed: AuthSession;
    try {
      parsed = JSON.parse(raw) as AuthSession;
    } catch {
      this.clearSession();
      return;
    }

    let claims: JwtClaims;
    try {
      claims = jwtDecode<JwtClaims>(parsed.token);
    } catch {
      this.clearSession();
      return;
    }

    // Use the JWT's own `exp` claim as the source of truth, not the
    // separately-stored expiresAtUtc (which a tamperer could rewrite).
    const expMs = typeof claims.exp === 'number' ? claims.exp * 1000 : 0;
    if (expMs <= Date.now()) {
      this.clearSession();
      return;
    }

    if (!claimsMatchSession(claims, parsed)) {
      this.clearSession();
      return;
    }

    this.sessionState.resetAll();
    this._session.set(parsed);
  }

  login(req: LoginRequest): Observable<AuthSession> {
    return this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/auth/login`, req, {
        context: this.localErrorContext(),
      })
      .pipe(
        map<AuthResponse, AuthSession>((res) => ({
          user: {
            userId: res.userId,
            fullName: res.fullName,
            email: res.email,
            role: normalizeRole(res.role),
            brandId: res.brandId,
          },
          tenantId: tenantIdFromToken(res.token),
          token: res.token,
          expiresAtUtc: res.expiresAtUtc,
        })),
        tap((session) => {
          this.sessionState.resetAll();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
          this._session.set(session);
        }),
      );
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
    this.sessionState.resetAll();
  }

  private localErrorContext(): HttpContext {
    return new HttpContext().set(HANDLE_ERROR_LOCALLY, true);
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
