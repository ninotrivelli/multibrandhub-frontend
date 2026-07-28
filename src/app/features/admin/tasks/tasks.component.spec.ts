import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';

import { makeStoreTask, paged } from '../../../../testing/builders';
import { primeNgTestProviders } from '../../../../testing/primeng-test-providers';
import { NotificationService } from '../../../core/notifications/notification.service';
import { TasksService } from '../../../core/tasks/tasks.service';
import { StoreTaskResponse } from '../../../core/tasks/tasks.types';
import { AdminTasksComponent } from './tasks.component';

describe('AdminTasksComponent', () => {
  let fixture: ComponentFixture<AdminTasksComponent>;
  let component: AdminTasksComponent;
  let tasksService: {
    loading: ReturnType<typeof signal<boolean>>;
    generalPending: ReturnType<typeof signal<StoreTaskResponse[]>>;
    personalPending: ReturnType<typeof signal<StoreTaskResponse[]>>;
    completed: ReturnType<typeof signal<StoreTaskResponse[]>>;
    completedTotalCount: ReturnType<typeof signal<number>>;
    completedPage: ReturnType<typeof signal<number>>;
    completedPageSize: ReturnType<typeof signal<number>>;
    loadingCompleted: ReturnType<typeof signal<boolean>>;
    loadPending: ReturnType<typeof vi.fn>;
    loadCompleted: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
  };
  let notifications: { success: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });
    tasksService = {
      loading: signal(false),
      generalPending: signal<StoreTaskResponse[]>([makeStoreTask({ id: 'task-general' })]),
      personalPending: signal<StoreTaskResponse[]>([
        makeStoreTask({ id: 'task-personal', scope: 'Personal' }),
      ]),
      completed: signal<StoreTaskResponse[]>([]),
      completedTotalCount: signal(0),
      completedPage: signal(1),
      completedPageSize: signal(10),
      loadingCompleted: signal(false),
      loadPending: vi.fn(() => of([])),
      loadCompleted: vi.fn(() => of(paged([]))),
      complete: vi.fn(() => of(void 0)),
    };
    notifications = { success: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AdminTasksComponent],
      providers: [
        { provide: TasksService, useValue: tasksService },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(AdminTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads pending tasks on init and exposes the scope lists', () => {
    expect(tasksService.loadPending).toHaveBeenCalledWith(['General', 'Personal']);
    expect((component as any).generalPending().map((t: StoreTaskResponse) => t.id)).toEqual([
      'task-general',
    ]);
    expect((component as any).personalPending().map((t: StoreTaskResponse) => t.id)).toEqual([
      'task-personal',
    ]);
  });

  it('tracks the completing task id while the request is in flight', () => {
    const response = new Subject<void>();
    tasksService.complete.mockReturnValue(response.asObservable());
    const task = makeStoreTask({ id: 'task-general' });

    (component as any).onComplete(task);

    expect(tasksService.complete).toHaveBeenCalledWith('task-general');
    expect((component as any).completingIds().has('task-general')).toBe(true);

    response.next();
    response.complete();

    expect((component as any).completingIds().has('task-general')).toBe(false);
    expect(notifications.success).toHaveBeenCalledWith('Tarea completada.');
    expect(tasksService.loadCompleted).toHaveBeenCalledWith(1, 10);
  });

  it('clears the completing id when completion fails', () => {
    const response = new Subject<void>();
    tasksService.complete.mockReturnValue(response.asObservable());
    const task = makeStoreTask({ id: 'task-fails' });

    (component as any).onComplete(task);
    response.error(new Error('boom'));

    expect((component as any).completingIds().has('task-fails')).toBe(false);
    expect(notifications.success).not.toHaveBeenCalled();
  });
});
