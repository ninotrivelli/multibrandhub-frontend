import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, delay, finalize, forkJoin, map, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { sortPendingTasks } from './tasks.utils';
import {
  CreateStoreTaskRequest,
  PagedResult,
  StoreTaskResponse,
  StoreTaskSearchParams,
  StoreTaskScope,
} from './tasks.types';

// Grace period so the checked checkbox stays visible before the row disappears.
export const COMPLETE_REMOVAL_DELAY_MS = 600;

// Pending lists are simple checklists, not paginated tables; load one generous
// page (backend caps pageSize at 100).
export const PENDING_PAGE_SIZE = 100;

export const COMPLETED_DEFAULT_PAGE_SIZE = 10;

interface ScopedTaskPage {
  scope: StoreTaskScope;
  result: PagedResult<StoreTaskResponse>;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = inject(SessionStateRegistry);
  private readonly baseUrl = `${environment.apiBaseUrl}/StoreTasks`;

  private readonly _generalPending = signal<StoreTaskResponse[]>([]);
  private readonly _personalPending = signal<StoreTaskResponse[]>([]);
  private readonly _loading = signal(false);

  private readonly _completed = signal<StoreTaskResponse[]>([]);
  private readonly _completedTotalCount = signal(0);
  private readonly _completedPage = signal(1);
  private readonly _completedPageSize = signal(COMPLETED_DEFAULT_PAGE_SIZE);
  private readonly _loadingCompleted = signal(false);

  readonly generalPending = this._generalPending.asReadonly();
  readonly personalPending = this._personalPending.asReadonly();
  readonly pending = computed(() => [...this._generalPending(), ...this._personalPending()]);
  readonly loading = this._loading.asReadonly();
  readonly hasPending = computed(() => this.pending().length > 0);

  readonly completed = this._completed.asReadonly();
  readonly completedTotalCount = this._completedTotalCount.asReadonly();
  readonly completedPage = this._completedPage.asReadonly();
  readonly completedPageSize = this._completedPageSize.asReadonly();
  readonly loadingCompleted = this._loadingCompleted.asReadonly();

  constructor() {
    this.sessionState.registerResetter(() => this.resetSessionState());
  }

  loadPending(scopes: readonly StoreTaskScope[]): Observable<ScopedTaskPage[]> {
    const generation = this.sessionState.captureGeneration();
    const requestedScopes = new Set(scopes);
    this._loading.set(true);
    return forkJoin(
      scopes.map((scope) =>
        this.search({ status: 'Pending', scope, page: 1, pageSize: PENDING_PAGE_SIZE }).pipe(
          map((result) => ({ scope, result })),
        ),
      ),
    ).pipe(
      tap((pages) => {
        if (!this.sessionState.isCurrentGeneration(generation)) return;
        if (requestedScopes.has('General')) {
          this._generalPending.set(this.tasksForScope(pages, 'General'));
        } else {
          this._generalPending.set([]);
        }
        if (requestedScopes.has('Personal')) {
          this._personalPending.set(this.tasksForScope(pages, 'Personal'));
        } else {
          this._personalPending.set([]);
        }
      }),
      finalize(() => {
        if (this.sessionState.isCurrentGeneration(generation)) this._loading.set(false);
      }),
    );
  }

  loadCompleted(
    page = 1,
    pageSize = COMPLETED_DEFAULT_PAGE_SIZE,
    scope?: StoreTaskScope,
  ): Observable<PagedResult<StoreTaskResponse>> {
    const generation = this.sessionState.captureGeneration();
    this._loadingCompleted.set(true);
    return this.search({ status: 'Completed', scope, page, pageSize }).pipe(
      tap({
        next: (res) => {
          if (!this.sessionState.isCurrentGeneration(generation)) return;
          this._completed.set(res.items);
          this._completedTotalCount.set(res.totalCount);
          this._completedPage.set(page);
          this._completedPageSize.set(pageSize);
          this._loadingCompleted.set(false);
        },
        error: () => {
          if (this.sessionState.isCurrentGeneration(generation)) this._loadingCompleted.set(false);
        },
      }),
    );
  }

  create(req: CreateStoreTaskRequest): Observable<StoreTaskResponse> {
    const generation = this.sessionState.captureGeneration();
    return this.http.post<StoreTaskResponse>(this.baseUrl, req).pipe(
      tap((created) => {
        if (this.sessionState.isCurrentGeneration(generation) && created.status === 'Pending') {
          this.updatePendingScope(created.scope, (curr) => sortPendingTasks([...curr, created]));
        }
      }),
    );
  }

  complete(id: string): Observable<void> {
    const generation = this.sessionState.captureGeneration();
    return this.http.patch<void>(`${this.baseUrl}/${id}/complete`, {}).pipe(
      delay(COMPLETE_REMOVAL_DELAY_MS),
      tap(() => {
        if (this.sessionState.isCurrentGeneration(generation)) {
          this._generalPending.update((curr) => curr.filter((t) => t.id !== id));
          this._personalPending.update((curr) => curr.filter((t) => t.id !== id));
        }
      }),
    );
  }

  search(params: StoreTaskSearchParams): Observable<PagedResult<StoreTaskResponse>> {
    let httpParams = new HttpParams()
      .set('page', params.page ?? 1)
      .set('pageSize', params.pageSize ?? COMPLETED_DEFAULT_PAGE_SIZE);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.scope) httpParams = httpParams.set('scope', params.scope);
    return this.http.get<PagedResult<StoreTaskResponse>>(this.baseUrl, { params: httpParams });
  }

  private tasksForScope(
    pages: readonly ScopedTaskPage[],
    scope: StoreTaskScope,
  ): StoreTaskResponse[] {
    const page = pages.find((p) => p.scope === scope);
    return page ? sortPendingTasks(page.result.items) : [];
  }

  private updatePendingScope(
    scope: StoreTaskScope,
    update: (current: StoreTaskResponse[]) => StoreTaskResponse[],
  ): void {
    if (scope === 'General') {
      this._generalPending.update(update);
    } else {
      this._personalPending.update(update);
    }
  }

  private resetSessionState(): void {
    this._generalPending.set([]);
    this._personalPending.set([]);
    this._loading.set(false);
    this._completed.set([]);
    this._completedTotalCount.set(0);
    this._completedPage.set(1);
    this._completedPageSize.set(COMPLETED_DEFAULT_PAGE_SIZE);
    this._loadingCompleted.set(false);
  }
}
