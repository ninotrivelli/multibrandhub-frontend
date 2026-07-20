import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { HANDLE_ERROR_LOCALLY } from '../http/local-error-handling';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import {
  CreateUserRequest,
  ListUsersParams,
  PagedResult,
  ResetPasswordRequest,
  ResetUserMfaRequest,
  UpdateUserRequest,
  UserResponse,
} from './users.types';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = inject(SessionStateRegistry);
  private readonly baseUrl = `${environment.apiBaseUrl}/users`;

  private readonly _items = signal<UserResponse[]>([]);
  private readonly _totalCount = signal(0);
  private readonly _loading = signal(false);

  readonly items = this._items.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly hasItems = computed(() => this._items().length > 0);

  constructor() {
    this.sessionState.registerResetter(() => this.resetSessionState());
  }

  list({ page = 1, pageSize = 100 }: ListUsersParams = {}): Observable<PagedResult<UserResponse>> {
    const generation = this.sessionState.captureGeneration();
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    this._loading.set(true);
    return this.http.get<PagedResult<UserResponse>>(this.baseUrl, { params }).pipe(
      tap({
        next: (res) => {
          if (!this.sessionState.isCurrentGeneration(generation)) return;
          this._items.set(res.items);
          this._totalCount.set(res.totalCount);
          this._loading.set(false);
        },
        error: () => {
          if (this.sessionState.isCurrentGeneration(generation)) this._loading.set(false);
        },
      }),
    );
  }

  getById(id: string): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.baseUrl}/${id}`);
  }

  create(req: CreateUserRequest): Observable<UserResponse> {
    const generation = this.sessionState.captureGeneration();
    return this.http.post<UserResponse>(this.baseUrl, req).pipe(
      tap((created) => {
        if (this.sessionState.isCurrentGeneration(generation)) {
          this._items.update((curr) => [created, ...curr]);
        }
      }),
    );
  }

  update(id: string, req: UpdateUserRequest): Observable<UserResponse> {
    const generation = this.sessionState.captureGeneration();
    return this.http.put<UserResponse>(`${this.baseUrl}/${id}`, req).pipe(
      tap((updated) => {
        if (this.sessionState.isCurrentGeneration(generation)) {
          this._items.update((curr) => curr.map((u) => (u.id === id ? updated : u)));
        }
      }),
    );
  }

  deactivate(id: string): Observable<void> {
    const generation = this.sessionState.captureGeneration();
    return this.http.patch<void>(`${this.baseUrl}/${id}/deactivate`, {}).pipe(
      tap(() => {
        if (this.sessionState.isCurrentGeneration(generation)) {
          this._items.update((curr) =>
            curr.map((u) => (u.id === id ? { ...u, isActive: false } : u)),
          );
        }
      }),
    );
  }

  resetPassword(id: string, newPassword: string): Observable<void> {
    const body: ResetPasswordRequest = { newPassword };
    return this.http.patch<void>(`${this.baseUrl}/${id}/password`, body);
  }

  resetMfa(id: string, body: ResetUserMfaRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/mfa/reset`, body, {
      context: new HttpContext().set(HANDLE_ERROR_LOCALLY, true),
    });
  }

  delete(id: string): Observable<void> {
    const generation = this.sessionState.captureGeneration();
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        if (this.sessionState.isCurrentGeneration(generation)) {
          this._items.update((curr) => curr.filter((u) => u.id !== id));
        }
      }),
    );
  }

  private resetSessionState(): void {
    this._items.set([]);
    this._totalCount.set(0);
    this._loading.set(false);
  }
}
