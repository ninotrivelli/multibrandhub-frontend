import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { makeStoreTask, paged } from '../../../testing/builders';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { COMPLETE_REMOVAL_DELAY_MS, PENDING_PAGE_SIZE, TasksService } from './tasks.service';
import { sortPendingTasks } from './tasks.utils';

describe('TasksService', () => {
  let service: TasksService;
  let sessionState: SessionStateRegistry;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/StoreTasks`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TasksService);
    sessionState = TestBed.inject(SessionStateRegistry);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads pending tasks with scoped query params', () => {
    const general = makeStoreTask({ id: 'task-general', scope: 'General' });
    const personal = makeStoreTask({ id: 'task-personal', scope: 'Personal' });

    service.loadPending(['General', 'Personal']).subscribe();
    const generalReq = http.expectOne(
      (r) =>
        r.url === baseUrl &&
        r.params.get('status') === 'Pending' &&
        r.params.get('scope') === 'General' &&
        r.params.get('page') === '1' &&
        r.params.get('pageSize') === String(PENDING_PAGE_SIZE),
    );
    const personalReq = http.expectOne(
      (r) =>
        r.url === baseUrl &&
        r.params.get('status') === 'Pending' &&
        r.params.get('scope') === 'Personal' &&
        r.params.get('page') === '1' &&
        r.params.get('pageSize') === String(PENDING_PAGE_SIZE),
    );
    expect(generalReq.request.method).toBe('GET');
    expect(personalReq.request.method).toBe('GET');
    expect(service.loading()).toBe(true);

    generalReq.flush(paged([general]));
    expect(service.loading()).toBe(true);
    personalReq.flush(paged([personal]));

    expect(service.loading()).toBe(false);
    expect(service.pending()).toEqual([general, personal]);
    expect(service.generalPending()).toEqual([general]);
    expect(service.personalPending()).toEqual([personal]);
    expect(service.hasPending()).toBe(true);
  });

  it('stops loading when the pending request fails', () => {
    service.loadPending(['General']).subscribe({ error: () => {} });
    const req = http.expectOne((r) => r.url === baseUrl);

    req.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(service.loading()).toBe(false);
    expect(service.pending()).toEqual([]);
  });

  it('loads a completed page and tracks pagination state', () => {
    const done = makeStoreTask({
      id: 'task-done',
      status: 'Completed',
      completedByUserId: 'user-seller',
      completedByName: 'Venta Mostrador',
      completedAtUtc: '2026-06-10T15:00:00Z',
    });

    service.loadCompleted(2, 20).subscribe();
    const req = http.expectOne(
      (r) =>
        r.url === baseUrl &&
        r.params.get('status') === 'Completed' &&
        r.params.get('page') === '2' &&
        r.params.get('pageSize') === '20',
    );
    expect(service.loadingCompleted()).toBe(true);

    req.flush(paged([done], { totalCount: 35, page: 2, pageSize: 20 }));

    expect(service.loadingCompleted()).toBe(false);
    expect(service.completed()).toEqual([done]);
    expect(service.completedTotalCount()).toBe(35);
    expect(service.completedPage()).toBe(2);
    expect(service.completedPageSize()).toBe(20);
  });

  it('loads completed tasks with scope when requested', () => {
    service.loadCompleted(1, 10, 'General').subscribe();

    const req = http.expectOne(
      (r) =>
        r.url === baseUrl &&
        r.params.get('status') === 'Completed' &&
        r.params.get('scope') === 'General' &&
        r.params.get('page') === '1' &&
        r.params.get('pageSize') === '10',
    );
    expect(req.request.method).toBe('GET');

    req.flush(paged([]));
  });

  it('creates a task and inserts it in backend order', () => {
    const high = makeStoreTask({
      id: 'task-high',
      priority: 'High',
      createdAt: '2026-06-01T08:00:00Z',
    });
    const low = makeStoreTask({
      id: 'task-low',
      priority: 'Low',
      createdAt: '2026-06-01T09:00:00Z',
    });

    service.loadPending(['General']).subscribe();
    http
      .expectOne((r) => r.url === baseUrl && r.params.get('scope') === 'General')
      .flush(paged([high, low]));

    const created = makeStoreTask({
      id: 'task-new',
      priority: 'Medium',
      createdAt: '2026-06-02T10:00:00Z',
    });
    service
      .create({ description: created.description, priority: 'Medium', scope: 'General' })
      .subscribe();

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      description: created.description,
      priority: 'Medium',
      scope: 'General',
    });
    req.flush(created);

    expect(service.generalPending().map((t) => t.id)).toEqual([
      'task-high',
      'task-new',
      'task-low',
    ]);
  });

  it('creates a personal task in the personal pending list', () => {
    service.loadPending(['General', 'Personal']).subscribe();
    http
      .expectOne((r) => r.url === baseUrl && r.params.get('scope') === 'General')
      .flush(paged([]));
    http
      .expectOne((r) => r.url === baseUrl && r.params.get('scope') === 'Personal')
      .flush(paged([]));

    const created = makeStoreTask({ id: 'task-personal', scope: 'Personal' });
    service
      .create({
        description: created.description,
        priority: created.priority,
        scope: created.scope,
      })
      .subscribe();

    http.expectOne(baseUrl).flush(created);

    expect(service.generalPending()).toEqual([]);
    expect(service.personalPending()).toEqual([created]);
  });

  it('completes a task and removes it from the pending list after the grace delay', () => {
    vi.useFakeTimers();
    try {
      const task = makeStoreTask({ id: 'task-done' });
      const other = makeStoreTask({ id: 'task-other', scope: 'Personal' });

      service.loadPending(['General', 'Personal']).subscribe();
      http
        .expectOne((r) => r.url === baseUrl && r.params.get('scope') === 'General')
        .flush(paged([task]));
      http
        .expectOne((r) => r.url === baseUrl && r.params.get('scope') === 'Personal')
        .flush(paged([other]));

      service.complete(task.id).subscribe();
      const req = http.expectOne(`${baseUrl}/${task.id}/complete`);
      expect(req.request.method).toBe('PATCH');
      req.flush(null, { status: 204, statusText: 'No Content' });

      // The row stays visible (checked) during the grace period.
      expect(service.pending().map((t) => t.id)).toEqual(['task-done', 'task-other']);

      vi.advanceTimersByTime(COMPLETE_REMOVAL_DELAY_MS);

      expect(service.generalPending()).toEqual([]);
      expect(service.personalPending().map((t) => t.id)).toEqual(['task-other']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears state and ignores late responses after session reset', () => {
    service.loadPending(['General', 'Personal']).subscribe();
    service.loadCompleted().subscribe();
    const generalReq = http.expectOne(
      (r) => r.params.get('status') === 'Pending' && r.params.get('scope') === 'General',
    );
    const personalReq = http.expectOne(
      (r) => r.params.get('status') === 'Pending' && r.params.get('scope') === 'Personal',
    );
    const completedReq = http.expectOne((r) => r.params.get('status') === 'Completed');
    expect(service.loading()).toBe(true);
    expect(service.loadingCompleted()).toBe(true);

    sessionState.resetAll();

    expect(service.pending()).toEqual([]);
    expect(service.completed()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.loadingCompleted()).toBe(false);

    generalReq.flush(paged([makeStoreTask()]));
    personalReq.flush(paged([makeStoreTask({ scope: 'Personal' })]));
    completedReq.flush(paged([makeStoreTask({ status: 'Completed' })]));

    expect(service.pending()).toEqual([]);
    expect(service.completed()).toEqual([]);
    expect(service.completedTotalCount()).toBe(0);
  });
});

describe('sortPendingTasks', () => {
  it('orders by priority desc then createdAt asc', () => {
    const oldLow = makeStoreTask({
      id: 'old-low',
      priority: 'Low',
      createdAt: '2026-06-01T08:00:00Z',
    });
    const newHigh = makeStoreTask({
      id: 'new-high',
      priority: 'High',
      createdAt: '2026-06-03T08:00:00Z',
    });
    const oldMedium = makeStoreTask({
      id: 'old-medium',
      priority: 'Medium',
      createdAt: '2026-06-01T09:00:00Z',
    });
    const newMedium = makeStoreTask({
      id: 'new-medium',
      priority: 'Medium',
      createdAt: '2026-06-02T09:00:00Z',
    });

    const sorted = sortPendingTasks([oldLow, newMedium, newHigh, oldMedium]);

    expect(sorted.map((t) => t.id)).toEqual(['new-high', 'old-medium', 'new-medium', 'old-low']);
  });

  it('does not mutate the input array', () => {
    const input = [
      makeStoreTask({ id: 'a', priority: 'Low' }),
      makeStoreTask({ id: 'b', priority: 'High' }),
    ];
    const copy = [...input];

    sortPendingTasks(input);

    expect(input).toEqual(copy);
  });
});
