import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';

import { AuthService } from '../../../core/auth/auth.service';
import {
  PASSWORD_VALIDATORS,
  passwordsMatchValidator,
} from '../../../core/auth/password-reset.validators';

const INVALID_LINK_MESSAGE = 'El enlace de recuperación no es válido o ya venció.';
const RATE_LIMIT_MESSAGE =
  'Demasiados intentos de recuperación. Intente nuevamente en unos minutos.';

type ResetPasswordState = 'form' | 'missingToken' | 'invalidToken' | 'success';

interface BackendErrorBody {
  message?: string;
  errors?: Array<{ property: string; message: string }>;
}

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, MessageModule, PasswordModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly resetToken = signal<string | null>(null);

  protected readonly state = signal<ResetPasswordState>('form');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', PASSWORD_VALIDATORS],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (token !== null) {
      void this.router.navigateByUrl('/reset-password', { replaceUrl: true });
    }

    if (!token?.trim()) {
      this.state.set('missingToken');
      return;
    }

    this.resetToken.set(token);
  }

  protected isInvalid(controlName: 'newPassword' | 'confirmPassword'): boolean {
    const control = this.form.controls[controlName];
    const mismatch =
      controlName === 'confirmPassword' &&
      this.form.hasError('passwordMismatch') &&
      (control.touched || control.dirty);
    return (control.invalid && (control.touched || control.dirty)) || mismatch;
  }

  protected submit(): void {
    if (this.submitting()) return;

    const token = this.resetToken();
    if (!token) {
      this.state.set('missingToken');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);

    this.auth
      .resetForgottenPassword(token, this.form.getRawValue().newPassword)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: () => {
          this.resetToken.set(null);
          this.form.reset();
          this.auth.clearSession();
          this.state.set('success');
        },
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
  }

  private handleError(error: HttpErrorResponse): void {
    const body = (error.error ?? {}) as BackendErrorBody;
    const tokenValidationError = body.errors?.some(
      (item) => item.property.toLowerCase() === 'token',
    );

    if (error.status === 400 && (body.message === INVALID_LINK_MESSAGE || tokenValidationError)) {
      this.resetToken.set(null);
      this.state.set('invalidToken');
      return;
    }

    if (body.errors?.length) {
      this.submitError.set(body.errors.map((item) => item.message).join(' • '));
      return;
    }

    if (error.status === 429) {
      this.submitError.set(body.message ?? RATE_LIMIT_MESSAGE);
      return;
    }

    this.submitError.set(body.message ?? 'No pudimos actualizar la contraseña. Probá de nuevo.');
  }
}
