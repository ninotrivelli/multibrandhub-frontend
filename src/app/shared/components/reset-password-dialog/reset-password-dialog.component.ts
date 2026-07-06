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
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../../../core/auth/auth.service';
import {
  PASSWORD_VALIDATORS,
  passwordsMatchValidator,
} from '../../../core/auth/password-reset.validators';
import { NotificationService } from '../../../core/notifications/notification.service';
import { UsersService } from '../../../core/users/users.service';

export interface ResetPasswordTarget {
  id: string;
  fullName: string;
  isSelf?: boolean;
}

@Component({
  selector: 'app-reset-password-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, PasswordModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reset-password-dialog.component.html',
})
export class ResetPasswordDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly notifications = inject(NotificationService);

  readonly visible = input.required<boolean>();
  readonly target = input<ResetPasswordTarget | null>(null);

  readonly visibleChange = output<boolean>();
  readonly success = output<void>();

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', PASSWORD_VALIDATORS],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  constructor() {
    effect(() => {
      const open = this.visible();
      if (open) untracked(() => this.resetForm());
    });
  }

  protected dialogHeader(): string {
    const t = this.target();
    if (!t) return 'Cambiar contraseña';
    if (t.isSelf) return 'Cambiar mi contraseña';
    return `Resetear contraseña — ${t.fullName}`;
  }

  protected isInvalid(controlName: 'newPassword' | 'confirmPassword'): boolean {
    const c = this.form.controls[controlName];
    const mismatch =
      controlName === 'confirmPassword' &&
      this.form.hasError('passwordMismatch') &&
      (c.touched || c.dirty);
    return (c.invalid && (c.touched || c.dirty)) || mismatch;
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

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const t = this.target();
    if (!t) return;

    this.submitError.set(null);
    this.submitting.set(true);

    const { newPassword } = this.form.getRawValue();

    this.users.resetPassword(t.id, newPassword).subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.emit();
        this.visibleChange.emit(false);
        if (t.isSelf) {
          this.notifications.success('Contraseña actualizada. Volvé a iniciar sesión.');
          this.auth.logout();
          return;
        }
        this.notifications.success('Contraseña actualizada.');
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
      this.submitError.set('No se pudo actualizar. Probá de nuevo.');
    }
  }

  private resetForm(): void {
    this.submitError.set(null);
    this.submitting.set(false);
    this.form.reset({ newPassword: '', confirmPassword: '' });
  }
}
