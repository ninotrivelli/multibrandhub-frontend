import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { StoreProfileResponse, UpdateStoreProfileRequest } from './store-profile.types';

@Injectable({ providedIn: 'root' })
export class StoreProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly sessionState = inject(SessionStateRegistry);
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
    this.sessionState.registerResetter(() => this.resetSessionState());

    effect(() => {
      if (this.auth.session() === null) this.resetSessionState();
    });
  }

  load(): Observable<StoreProfileResponse> {
    const generation = this.sessionState.captureGeneration();
    this._loading.set(true);
    return this.http.get<StoreProfileResponse>(this.baseUrl).pipe(
      tap({
        next: (res) => {
          if (!this.sessionState.isCurrentGeneration(generation)) return;
          this._profile.set(res);
          this._loading.set(false);
        },
        error: () => {
          if (this.sessionState.isCurrentGeneration(generation)) this._loading.set(false);
        },
      }),
    );
  }

  update(req: UpdateStoreProfileRequest): Observable<StoreProfileResponse> {
    const generation = this.sessionState.captureGeneration();
    this._saving.set(true);
    return this.http.put<StoreProfileResponse>(this.baseUrl, req).pipe(
      tap({
        next: (res) => {
          if (!this.sessionState.isCurrentGeneration(generation)) return;
          this._profile.set(res);
          this._saving.set(false);
        },
        error: () => {
          if (this.sessionState.isCurrentGeneration(generation)) this._saving.set(false);
        },
      }),
    );
  }

  private resetSessionState(): void {
    this._profile.set(null);
    this._loading.set(false);
    this._saving.set(false);
  }
}
