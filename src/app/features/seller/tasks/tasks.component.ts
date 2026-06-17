import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { LucideAngularModule, Plus, RefreshCw } from 'lucide-angular';

import { NotificationService } from '../../../core/notifications/notification.service';
import { TasksService } from '../../../core/tasks/tasks.service';
import { StoreTaskResponse } from '../../../core/tasks/tasks.types';
import { TaskListComponent } from '../../shared/tasks/task-list/task-list.component';
import { TaskFormDialogComponent } from '../../shared/tasks/task-form-dialog/task-form-dialog.component';
import { TaskHistoryComponent } from '../../shared/tasks/task-history/task-history.component';

@Component({
  selector: 'app-seller-tasks',
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
export class SellerTasksComponent implements OnInit {
  private readonly tasksService = inject(TasksService);
  private readonly notifications = inject(NotificationService);

  protected readonly icons = { Plus, RefreshCw };

  protected readonly loading = this.tasksService.loading;
  protected readonly generalPending = this.tasksService.generalPending;

  protected readonly dialogVisible = signal(false);
  protected readonly completingIds = signal<ReadonlySet<string>>(new Set<string>());

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    this.tasksService.loadPending(['General']).subscribe({
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

  private refreshCompleted(): void {
    this.tasksService.loadCompleted(1, this.tasksService.completedPageSize(), 'General').subscribe({
      error: () => {
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
