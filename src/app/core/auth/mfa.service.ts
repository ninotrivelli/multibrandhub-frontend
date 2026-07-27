import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, of, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { HANDLE_ERROR_LOCALLY } from '../http/local-error-handling';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import {
  ConfirmMfaSetupRequest,
  MfaReauthenticationRequest,
  MfaRecoveryCodesResponse,
  MfaSetupResponse,
  MfaStatusResponse,
  StartMfaSetupRequest,
} from './auth.types';

@Injectable({ providedIn: 'root' })
export class MfaService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = inject(SessionStateRegistry);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth/mfa`;

  private readonly _status = signal<MfaStatusResponse | null>(null);
  private readonly _loadingStatus = signal(false);
  private statusRequest: Observable<MfaStatusResponse> | null = null;

  readonly status = this._status.asReadonly();
  readonly loadingStatus = this._loadingStatus.asReadonly();

  constructor() {
    this.sessionState.registerResetter(() => this.resetSessionState());
  }

  loadStatus(force = false): Observable<MfaStatusResponse> {
    if (!force && this._status()) return of(this._status()!);
    if (!force && this.statusRequest) return this.statusRequest;

    this._loadingStatus.set(true);
    const request = this.http.get<MfaStatusResponse>(`${this.baseUrl}/status`).pipe(
      tap((status) => this._status.set(status)),
      finalize(() => {
        this._loadingStatus.set(false);
        this.statusRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.statusRequest = request;
    return request;
  }

  startSetup(currentPassword: string): Observable<MfaSetupResponse> {
    const body: StartMfaSetupRequest = { currentPassword };
    return this.http.post<MfaSetupResponse>(`${this.baseUrl}/setup`, body, {
      context: this.localErrorContext(),
    });
  }

  confirmSetup(code: string): Observable<MfaRecoveryCodesResponse> {
    const body: ConfirmMfaSetupRequest = { code };
    return this.http.post<MfaRecoveryCodesResponse>(`${this.baseUrl}/setup/confirm`, body, {
      context: this.localErrorContext(),
    });
  }

  regenerateRecoveryCodes(body: MfaReauthenticationRequest): Observable<MfaRecoveryCodesResponse> {
    return this.http.post<MfaRecoveryCodesResponse>(
      `${this.baseUrl}/recovery-codes/regenerate`,
      body,
      { context: this.localErrorContext() },
    );
  }

  disable(body: MfaReauthenticationRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/disable`, body, {
      context: this.localErrorContext(),
    });
  }

  clearStatus(): void {
    this._status.set(null);
  }

  private localErrorContext(): HttpContext {
    return new HttpContext().set(HANDLE_ERROR_LOCALLY, true);
  }

  private resetSessionState(): void {
    this._status.set(null);
    this._loadingStatus.set(false);
    this.statusRequest = null;
  }
}
