import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, finalize, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import {
  CashRegisterHistoryRequest,
  CashRegisterSessionResponse,
  CashRegisterSessionSummaryResponse,
  CloseCashRegisterRequest,
  OpenCashRegisterRequest,
  PagedResult,
} from './cash-register.types';

export const CASH_REGISTER_HISTORY_DEFAULT_PAGE_SIZE = 10;

@Injectable({ providedIn: 'root' })
export class CashRegisterService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = inject(SessionStateRegistry);
  private readonly baseUrl = `${environment.apiBaseUrl}/cash-register`;

  private readonly _current = signal<CashRegisterSessionResponse | null>(null);
  private readonly _currentLoaded = signal(false);
  private readonly _currentLoading = signal(false);
  private readonly _currentError = signal<string | null>(null);

  private readonly _selectedReport = signal<CashRegisterSessionResponse | null>(null);
  private readonly _reportLoading = signal(false);
  private readonly _reportError = signal<string | null>(null);

  private readonly _historyItems = signal<CashRegisterSessionSummaryResponse[]>([]);
  private readonly _historyTotalCount = signal(0);
  private readonly _historyPage = signal(1);
  private readonly _historyPageSize = signal(CASH_REGISTER_HISTORY_DEFAULT_PAGE_SIZE);
  private readonly _historyLoading = signal(false);
  private readonly _historyError = signal<string | null>(null);

  readonly current = this._current.asReadonly();
  readonly currentLoaded = this._currentLoaded.asReadonly();
  readonly currentLoading = this._currentLoading.asReadonly();
  readonly currentError = this._currentError.asReadonly();
  readonly hasOpenRegister = computed(() => this._current()?.status === 'Open');

  readonly selectedReport = this._selectedReport.asReadonly();
  readonly reportLoading = this._reportLoading.asReadonly();
  readonly reportError = this._reportError.asReadonly();

  readonly historyItems = this._historyItems.asReadonly();
  readonly historyTotalCount = this._historyTotalCount.asReadonly();
  readonly historyPage = this._historyPage.asReadonly();
  readonly historyPageSize = this._historyPageSize.asReadonly();
  readonly historyLoading = this._historyLoading.asReadonly();
  readonly historyError = this._historyError.asReadonly();
  readonly hasHistory = computed(() => this._historyItems().length > 0);

  constructor() {
    this.sessionState.registerResetter(() => this.resetSessionState());
  }

  loadCurrent(): Observable<CashRegisterSessionResponse | null> {
    const generation = this.sessionState.captureGeneration();
    this._currentLoading.set(true);
    this._currentError.set(null);

    return this.http.get<CashRegisterSessionResponse | null>(`${this.baseUrl}/current`).pipe(
      tap({
        next: (session) => {
          if (!this.sessionState.isCurrentGeneration(generation)) return;
          this._current.set(session);
          this._currentLoaded.set(true);
        },
        error: () => {
          if (!this.sessionState.isCurrentGeneration(generation)) return;
          this._currentLoaded.set(true);
          this._currentError.set('No se pudo cargar el estado de caja.');
        },
      }),
      finalize(() => {
        if (this.sessionState.isCurrentGeneration(generation)) this._currentLoading.set(false);
      }),
    );
  }

  open(req: OpenCashRegisterRequest): Observable<CashRegisterSessionResponse> {
    const generation = this.sessionState.captureGeneration();
    return this.http.post<CashRegisterSessionResponse>(`${this.baseUrl}/open`, req).pipe(
      tap((session) => {
        if (!this.sessionState.isCurrentGeneration(generation)) return;
        this._current.set(session);
        this._currentLoaded.set(true);
        this._currentError.set(null);
        this._selectedReport.set(null);
      }),
    );
  }

  close(id: string, req: CloseCashRegisterRequest): Observable<CashRegisterSessionResponse> {
    const generation = this.sessionState.captureGeneration();
    return this.http.post<CashRegisterSessionResponse>(`${this.baseUrl}/${id}/close`, req).pipe(
      tap((session) => {
        if (!this.sessionState.isCurrentGeneration(generation)) return;
        this._current.set(null);
        this._currentLoaded.set(true);
        this._selectedReport.set(session);
        this._reportError.set(null);
      }),
    );
  }

  getById(id: string): Observable<CashRegisterSessionResponse> {
    const generation = this.sessionState.captureGeneration();
    this._reportLoading.set(true);
    this._reportError.set(null);

    return this.http.get<CashRegisterSessionResponse>(`${this.baseUrl}/${id}`).pipe(
      tap({
        next: (session) => {
          if (!this.sessionState.isCurrentGeneration(generation)) return;
          this._selectedReport.set(session);
        },
        error: () => {
          if (this.sessionState.isCurrentGeneration(generation)) {
            this._reportError.set('No se pudo cargar el reporte de caja.');
          }
        },
      }),
      finalize(() => {
        if (this.sessionState.isCurrentGeneration(generation)) this._reportLoading.set(false);
      }),
    );
  }

  loadHistory(
    params: CashRegisterHistoryRequest = {},
  ): Observable<PagedResult<CashRegisterSessionSummaryResponse>> {
    const generation = this.sessionState.captureGeneration();
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? CASH_REGISTER_HISTORY_DEFAULT_PAGE_SIZE;
    const httpParams = this.buildHistoryParams({ ...params, page, pageSize });

    this._historyLoading.set(true);
    this._historyError.set(null);

    return this.http
      .get<PagedResult<CashRegisterSessionSummaryResponse>>(`${this.baseUrl}/history`, {
        params: httpParams,
      })
      .pipe(
        tap({
          next: (result) => {
            if (!this.sessionState.isCurrentGeneration(generation)) return;
            this._historyItems.set(result.items);
            this._historyTotalCount.set(result.totalCount);
            this._historyPage.set(result.page);
            this._historyPageSize.set(result.pageSize);
          },
          error: () => {
            if (this.sessionState.isCurrentGeneration(generation)) {
              this._historyError.set('No se pudo cargar el historial de caja.');
            }
          },
        }),
        finalize(() => {
          if (this.sessionState.isCurrentGeneration(generation)) this._historyLoading.set(false);
        }),
      );
  }

  clearSelectedReport(): void {
    this._selectedReport.set(null);
    this._reportError.set(null);
  }

  private buildHistoryParams(
    params: Required<Pick<CashRegisterHistoryRequest, 'page' | 'pageSize'>> &
      Omit<CashRegisterHistoryRequest, 'page' | 'pageSize'>,
  ): HttpParams {
    let httpParams = new HttpParams().set('page', params.page).set('pageSize', params.pageSize);
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    return httpParams;
  }

  private resetSessionState(): void {
    this._current.set(null);
    this._currentLoaded.set(false);
    this._currentLoading.set(false);
    this._currentError.set(null);
    this._selectedReport.set(null);
    this._reportLoading.set(false);
    this._reportError.set(null);
    this._historyItems.set([]);
    this._historyTotalCount.set(0);
    this._historyPage.set(1);
    this._historyPageSize.set(CASH_REGISTER_HISTORY_DEFAULT_PAGE_SIZE);
    this._historyLoading.set(false);
    this._historyError.set(null);
  }
}
