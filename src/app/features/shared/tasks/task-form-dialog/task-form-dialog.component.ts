import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { Lock, LucideAngularModule, Users } from 'lucide-angular';

import { NotificationService } from '../../../../core/notifications/notification.service';
import { TasksService } from '../../../../core/tasks/tasks.service';
import {
  CreateStoreTaskRequest,
  StoreTaskPriority,
  StoreTaskResponse,
  StoreTaskScope,
} from '../../../../core/tasks/tasks.types';
import { PRIORITY_OPTIONS } from '../task-priority';

const MAX_DESCRIPTION_LENGTH = 500;

interface ScopeOption {
  label: string;
  value: StoreTaskScope;
  icon: typeof Users;
}

@Component({
  selector: 'app-task-form-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    MessageModule,
    SelectModule,
    SelectButtonModule,
    TextareaModule,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-form-dialog.component.html',
})
export class TaskFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tasks = inject(TasksService);
  private readonly notifications = inject(NotificationService);

  readonly visible = input.required<boolean>();
  // Sellers may only create General tasks (backend rejects Personal with 403),
  // so the scope selector is only rendered when this is true.
  readonly canCreatePersonal = input(false);

  readonly visibleChange = output<boolean>();
  readonly saved = output<StoreTaskResponse>();

  protected readonly priorityOptions = PRIORITY_OPTIONS;
  protected readonly scopeOptions: ScopeOption[] = [
    { label: 'Del local', value: 'General', icon: Users },
    { label: 'Personal', value: 'Personal', icon: Lock },
  ];
  protected readonly maxDescriptionLength = MAX_DESCRIPTION_LENGTH;

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    description: ['', [Validators.required, Validators.maxLength(MAX_DESCRIPTION_LENGTH)]],
    priority: ['Medium' as StoreTaskPriority, [Validators.required]],
    scope: ['General' as StoreTaskScope],
  });

  constructor() {
    effect(() => {
      const open = this.visible();
      if (open) {
        untracked(() => this.resetForm());
      }
    });
  }

  protected get descriptionLength(): number {
    return this.form.controls.description.value.length;
  }

  protected isDescriptionInvalid(): boolean {
    const c = this.form.controls.description;
    return c.invalid && (c.touched || c.dirty);
  }

  protected onVisibleChange(value: boolean): void {
    if (!value && this.submitting()) return;
    this.visibleChange.emit(value);
  }

  protected cancel(): void {
    this.visibleChange.emit(false);
  }

  protected submit(): void {
    if (this.submitting()) return;

    // Description with only whitespace passes `required`; treat it as empty.
    const description = this.form.controls.description.value.trim();
    if (!description) {
      this.form.controls.description.setValue('');
      this.form.controls.description.markAsTouched();
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);

    const raw = this.form.getRawValue();
    const payload: CreateStoreTaskRequest = {
      description,
      priority: raw.priority,
      scope: this.canCreatePersonal() ? raw.scope : 'General',
    };

    this.tasks.create(payload).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.notifications.success('Tarea creada.');
        this.saved.emit(created);
        this.visibleChange.emit(false);
      },
      error: (err: HttpErrorResponse) => this.handleError(err),
    });
  }

  private handleError(err: HttpErrorResponse): void {
    this.submitting.set(false);
    const body = err.error as { message?: string; errors?: { message: string }[] } | undefined;
    if (body?.errors?.length) {
      this.submitError.set(body.errors.map((e) => e.message).join(' • '));
    } else if (body?.message) {
      this.submitError.set(body.message);
    } else {
      this.submitError.set('No se pudo crear la tarea. Probá de nuevo.');
    }
  }

  private resetForm(): void {
    this.submitError.set(null);
    this.form.reset({
      description: '',
      priority: 'Medium',
      scope: 'General',
    });
  }
}
