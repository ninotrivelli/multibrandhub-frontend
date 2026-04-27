import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-admin-tasks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-2xl font-semibold text-surface-900 dark:text-surface-0">Tareas</h1>
      <p class="text-surface-500 dark:text-surface-400 mt-1">Tareas del Local + Mis Tareas</p>
    </div>
  `
})
export class AdminTasksComponent {}
