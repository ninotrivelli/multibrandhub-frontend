import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';

import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { History, LucideAngularModule } from 'lucide-angular';

import { COMPLETED_DEFAULT_PAGE_SIZE, TasksService } from '../../../../core/tasks/tasks.service';
import { StoreTaskResponse, StoreTaskScope } from '../../../../core/tasks/tasks.types';
import { PRIORITY_LABELS, PRIORITY_SEVERITY } from '../task-priority';

const SCOPE_LABELS: Record<StoreTaskScope, string> = {
  General: 'Del local',
  Personal: 'Personal',
};

const SCOPE_SEVERITY: Record<StoreTaskScope, 'secondary' | 'info'> = {
  General: 'secondary',
  Personal: 'info',
};

@Component({
  selector: 'app-task-history',
  imports: [DatePipe, TableModule, TagModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-history.component.html',
})
export class TaskHistoryComponent {
  private readonly tasksService = inject(TasksService);

  readonly scope = input<StoreTaskScope | undefined>(undefined);

  protected readonly icons = { History };

  protected readonly completed = this.tasksService.completed;
  protected readonly totalCount = this.tasksService.completedTotalCount;
  protected readonly page = this.tasksService.completedPage;
  protected readonly pageSize = this.tasksService.completedPageSize;
  protected readonly loading = this.tasksService.loadingCompleted;

  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly prioritySeverity = PRIORITY_SEVERITY;
  protected readonly scopeLabels = SCOPE_LABELS;
  protected readonly scopeSeverity = SCOPE_SEVERITY;

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const pageSize = event.rows ?? COMPLETED_DEFAULT_PAGE_SIZE;
    const page = Math.floor((event.first ?? 0) / pageSize) + 1;
    this.tasksService.loadCompleted(page, pageSize, this.scope()).subscribe({
      error: () => {
        // error.interceptor already shows a toast
      },
    });
  }

  protected scopeLabel(task: StoreTaskResponse): string {
    return this.scopeLabels[task.scope];
  }

  protected scopeSeverityFor(task: StoreTaskResponse): 'secondary' | 'info' {
    return this.scopeSeverity[task.scope];
  }

  protected priorityLabel(task: StoreTaskResponse): string {
    return this.priorityLabels[task.priority];
  }

  protected prioritySeverityFor(task: StoreTaskResponse): 'danger' | 'warn' | 'secondary' {
    return this.prioritySeverity[task.priority];
  }
}
