import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CheckboxModule } from 'primeng/checkbox';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

import { StoreTaskResponse } from '../../../../core/tasks/tasks.types';
import { PRIORITY_LABELS, PRIORITY_SEVERITY } from '../task-priority';

@Component({
  selector: 'app-task-list',
  imports: [DatePipe, FormsModule, CheckboxModule, SkeletonModule, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-list.component.html',
})
export class TaskListComponent {
  readonly tasks = input.required<StoreTaskResponse[]>();
  readonly loading = input(false);
  readonly emptyMessage = input('No hay tareas pendientes.');
  readonly completingIds = input<ReadonlySet<string>>(new Set<string>());

  readonly completeTask = output<StoreTaskResponse>();

  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly prioritySeverity = PRIORITY_SEVERITY;

  protected isCompleting(task: StoreTaskResponse): boolean {
    return this.completingIds().has(task.id);
  }

  protected onToggle(task: StoreTaskResponse): void {
    if (this.isCompleting(task)) return;
    this.completeTask.emit(task);
  }
}
