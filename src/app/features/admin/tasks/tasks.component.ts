import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { Lock, LucideAngularModule, Plus, RefreshCw, Users } from 'lucide-angular';

import { NotificationService } from '../../../core/notifications/notification.service';
import { TasksService } from '../../../core/tasks/tasks.service';
import { StoreTaskResponse } from '../../../core/tasks/tasks.types';
import { TaskListComponent } from '../../shared/tasks/task-list/task-list.component';
import { TaskFormDialogComponent } from '../../shared/tasks/task-form-dialog/task-form-dialog.component';
import { TaskHistoryComponent } from '../../shared/tasks/task-history/task-history.component';

@Component({
  selector: 'app-admin-tasks',
  imports: [
    ButtonModule,
    LucideAngularModule,
    TaskListComponent,
    TaskFormDialogComponent,
    TaskHistoryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tasks.component.html',
})
export class AdminTasksComponent implements OnInit {
  private readonly tasksService = inject(TasksService);
  private readonly notifications = inject(NotificationService);

  protected readonly icons = { Plus, RefreshCw, Users, Lock };

  protected readonly loading = this.tasksService.loading;
  protected readonly generalPending = this.tasksService.generalPending;
  protected readonly personalPending = this.tasksService.personalPending;

  protected readonly dialogVisible = signal(false);
  protected readonly completingIds = signal<ReadonlySet<string>>(new Set<string>());

  ngOnInit(): void {
    // The history table triggers its own initial load via the table's lazy load event.
    this.loadPending();
  }

  protected refresh(): void {
    this.loadPending();
    this.refreshCompleted();
  }

  private loadPending(): void {
    this.tasksService.loadPending(['General', 'Personal']).subscribe({
      error: () => {
        // error.interceptor already shows a toast
      },
    });
  }

  private refreshCompleted(): void {
    this.tasksService.loadCompleted(1, this.tasksService.completedPageSize()).subscribe({
      error: () => {
        // error.interceptor already shows a toast
      },
    });
  }

  protected openCreate(): void {
    this.dialogVisible.set(true);
  }

  protected onDialogVisibleChange(value: boolean): void {
    this.dialogVisible.set(value);
  }

  protected onComplete(task: StoreTaskResponse): void {
    this.markCompleting(task.id, true);
    this.tasksService.complete(task.id).subscribe({
      next: () => {
        this.markCompleting(task.id, false);
        this.notifications.success('Tarea completada.');
        this.refreshCompleted();
      },
      error: () => {
        this.markCompleting(task.id, false);
        // error.interceptor already shows a toast
      },
    });
  }

  private markCompleting(id: string, completing: boolean): void {
    this.completingIds.update((curr) => {
      const next = new Set(curr);
      if (completing) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
