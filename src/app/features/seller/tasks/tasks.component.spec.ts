import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeStoreTask } from '../../../../testing/builders';
import { NotificationService } from '../../../core/notifications/notification.service';
import { TasksService } from '../../../core/tasks/tasks.service';
import { StoreTaskResponse } from '../../../core/tasks/tasks.types';
import { SellerTasksComponent } from './tasks.component';

describe('SellerTasksComponent', () => {
  let fixture: ComponentFixture<SellerTasksComponent>;
  let component: SellerTasksComponent;
  let tasksService: {
    loading: ReturnType<typeof signal<boolean>>;
    generalPending: ReturnType<typeof signal<StoreTaskResponse[]>>;
    completedPageSize: ReturnType<typeof signal<number>>;
    loadPending: ReturnType<typeof vi.fn>;
    loadCompleted: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
  };
  let notifications: { success: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    tasksService = {
      loading: signal(false),
      generalPending: signal<StoreTaskResponse[]>([makeStoreTask({ id: 'task-general' })]),
      completedPageSize: signal(10),
      loadPending: vi.fn(() => of([])),
      loadCompleted: vi.fn(() => of([])),
      complete: vi.fn(() => of(void 0)),
    };
    notifications = { success: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SellerTasksComponent],
      providers: [
        { provide: TasksService, useValue: tasksService },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    TestBed.overrideComponent(SellerTasksComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(SellerTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads pending tasks on init', () => {
    expect(tasksService.loadPending).toHaveBeenCalledWith(['General']);
    expect((component as any).generalPending().map((t: StoreTaskResponse) => t.id)).toEqual([
      'task-general',
    ]);
  });

  it('completes a task and notifies', () => {
    const task = makeStoreTask({ id: 'task-general' });

    (component as any).onComplete(task);

    expect(tasksService.complete).toHaveBeenCalledWith('task-general');
    expect((component as any).completingIds().has('task-general')).toBe(false);
    expect(notifications.success).toHaveBeenCalledWith('Tarea completada.');
    expect(tasksService.loadCompleted).toHaveBeenCalledWith(1, 10, 'General');
  });
});
