import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import {
  CreateUserRequest,
  ListUsersParams,
  PagedResult,
  ResetPasswordRequest,
  UpdateUserRequest,
  UserResponse
} from './users.types';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/users`;

  private readonly _items = signal<UserResponse[]>([]);
  private readonly _totalCount = signal(0);
  private readonly _loading = signal(false);

  readonly items = this._items.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly hasItems = computed(() => this._items().length > 0);

  list({ page = 1, pageSize = 100 }: ListUsersParams = {}): Observable<PagedResult<UserResponse>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    this._loading.set(true);
    return this.http.get<PagedResult<UserResponse>>(this.baseUrl, { params }).pipe(
      tap({
        next: (res) => {
          this._items.set(res.items);
          this._totalCount.set(res.totalCount);
          this._loading.set(false);
        },
        error: () => this._loading.set(false)
      })
    );
  }

  getById(id: string): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.baseUrl}/${id}`);
  }

  create(req: CreateUserRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(this.baseUrl, req).pipe(
      tap((created) => this._items.update((curr) => [created, ...curr]))
    );
  }

  update(id: string, req: UpdateUserRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.baseUrl}/${id}`, req).pipe(
      tap((updated) =>
        this._items.update((curr) => curr.map((u) => (u.id === id ? updated : u)))
      )
    );
  }

  deactivate(id: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/deactivate`, {}).pipe(
      tap(() =>
        this._items.update((curr) =>
          curr.map((u) => (u.id === id ? { ...u, isActive: false } : u))
        )
      )
    );
  }

  resetPassword(id: string, newPassword: string): Observable<void> {
    const body: ResetPasswordRequest = { newPassword };
    return this.http.patch<void>(`${this.baseUrl}/${id}/password`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this._items.update((curr) => curr.filter((u) => u.id !== id)))
    );
  }
}
