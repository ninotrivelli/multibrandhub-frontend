import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  AuthSession,
  AuthUser,
  JwtClaims,
  LoginRequest,
  RoleWire,
  UserRole
} from './auth.types';

const STORAGE_KEY = 'mbh.token';

const ROLE_BY_INT: Record<number, UserRole> = {
  1: 'SuperAdmin',
  2: 'Admin',
  3: 'BrandManager',
  4: 'Seller'
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

function claimsMatchUser(claims: JwtClaims, user: AuthUser): boolean {
  const claimSub = claims.sub ?? firstString(claims.nameid);
  if (claimSub !== user.userId) return false;

  const claimEmail = firstString(claims.email);
  if (claimEmail !== user.email) return false;

  const rawRole = firstString(claims.role);
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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _session = signal<AuthSession | null>(null);

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly token = computed(() => this._session()?.token ?? null);
  readonly role = computed<UserRole | null>(() => this._session()?.user.role ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);

  restoreSession(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    let parsed: AuthSession;
    try {
      parsed = JSON.parse(raw) as AuthSession;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    let claims: JwtClaims;
    try {
      claims = jwtDecode<JwtClaims>(parsed.token);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Use the JWT's own `exp` claim as the source of truth, not the
    // separately-stored expiresAtUtc (which a tamperer could rewrite).
    const expMs = typeof claims.exp === 'number' ? claims.exp * 1000 : 0;
    if (expMs <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (!claimsMatchUser(claims, parsed.user)) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    this._session.set(parsed);
  }

  login(req: LoginRequest): Observable<AuthSession> {
    return this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/auth/login`, req)
      .pipe(
        map<AuthResponse, AuthSession>((res) => ({
          user: {
            userId: res.userId,
            fullName: res.fullName,
            email: res.email,
            role: normalizeRole(res.role),
            brandId: res.brandId
          },
          token: res.token,
          expiresAtUtc: res.expiresAtUtc
        })),
        tap((session) => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
          this._session.set(session);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._session.set(null);
    this.router.navigate(['/login']);
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
