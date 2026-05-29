import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { StoreProfileResponse, UpdateStoreProfileRequest } from './store-profile.types';

@Injectable({ providedIn: 'root' })
export class StoreProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiBaseUrl}/store-profile`;

  private readonly _profile = signal<StoreProfileResponse | null>(null);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);

  readonly profile = this._profile.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();

  readonly hasData = computed(() => !!this._profile()?.storeName);
  readonly storeName = computed(() => this._profile()?.storeName ?? '');

  constructor() {
    effect(() => {
      if (this.auth.session() === null) this._profile.set(null);
    });
  }

  load(): Observable<StoreProfileResponse> {
    this._loading.set(true);
    return this.http.get<StoreProfileResponse>(this.baseUrl).pipe(
      tap({
        next: (res) => {
          this._profile.set(res);
          this._loading.set(false);
        },
        error: () => this._loading.set(false),
      }),
    );
  }

  update(req: UpdateStoreProfileRequest): Observable<StoreProfileResponse> {
    this._saving.set(true);
    return this.http.put<StoreProfileResponse>(this.baseUrl, req).pipe(
      tap({
        next: (res) => {
          this._profile.set(res);
          this._saving.set(false);
        },
        error: () => this._saving.set(false),
      }),
    );
  }
}
