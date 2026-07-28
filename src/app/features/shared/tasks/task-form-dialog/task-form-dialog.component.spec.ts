import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeStoreTask } from '../../../../../testing/builders';
import { primeNgTestProviders } from '../../../../../testing/primeng-test-providers';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { TasksService } from '../../../../core/tasks/tasks.service';
import { CreateStoreTaskRequest } from '../../../../core/tasks/tasks.types';
import { TaskFormDialogComponent } from './task-form-dialog.component';

describe('TaskFormDialogComponent', () => {
  let fixture: ComponentFixture<TaskFormDialogComponent>;
  let component: TaskFormDialogComponent;
  let tasks: { create: ReturnType<typeof vi.fn> };
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });
    tasks = {
      create: vi.fn((body: CreateStoreTaskRequest) =>
        of(makeStoreTask({ ...body, id: 'task-created' })),
      ),
    };
    notifications = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [TaskFormDialogComponent],
      providers: [
        { provide: TasksService, useValue: tasks },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(TaskFormDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
  });

  function openDialog(canCreatePersonal: boolean): void {
    fixture.componentRef.setInput('canCreatePersonal', canCreatePersonal);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  it('blocks submit when the description is empty or whitespace', () => {
    openDialog(true);

    (component as any).form.patchValue({ description: '   ' });
    (component as any).submit();

    expect(tasks.create).not.toHaveBeenCalled();
    expect((component as any).form.controls.description.hasError('required')).toBe(true);
  });

  it('creates the task with the trimmed description and emits saved + close', () => {
    const saved = vi.fn();
    const visibleChange = vi.fn();
    component.saved.subscribe(saved);
    component.visibleChange.subscribe(visibleChange);

    openDialog(true);
    (component as any).form.patchValue({
      description: '  Reponer perchas  ',
      priority: 'High',
      scope: 'Personal',
    });
    (component as any).submit();

    expect(tasks.create).toHaveBeenCalledWith({
      description: 'Reponer perchas',
      priority: 'High',
      scope: 'Personal',
    });
    expect(notifications.success).toHaveBeenCalledWith('Tarea creada.');
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-created' }));
    expect(visibleChange).toHaveBeenCalledWith(false);
  });

  it('forces General scope when personal tasks are not allowed', () => {
    openDialog(false);
    (component as any).form.patchValue({ description: 'Limpiar exhibidor', scope: 'Personal' });

    (component as any).submit();

    expect(tasks.create).toHaveBeenCalledWith(expect.objectContaining({ scope: 'General' }));
  });

  it('resets the form each time the dialog opens', () => {
    openDialog(true);
    (component as any).form.patchValue({
      description: 'Algo viejo',
      priority: 'Low',
      scope: 'Personal',
    });

    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    expect((component as any).form.getRawValue()).toEqual({
      description: '',
      priority: 'Medium',
      scope: 'General',
    });
  });
});
