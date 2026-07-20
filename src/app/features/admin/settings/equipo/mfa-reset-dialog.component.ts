import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, timer } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { TextareaModule } from 'primeng/textarea';

import { MfaVerificationMethod } from '../../../../core/auth/auth.types';
import { MfaService } from '../../../../core/auth/mfa.service';
import { retryAfterLabel, retryAfterUtc } from '../../../../core/http/retry-after';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { UsersService } from '../../../../core/users/users.service';
import { UserResponse } from '../../../../core/users/users.types';

interface BackendErrorBody {
  message?: string;
  errors?: Array<{ message: string }>;
}

@Component({
  selector: 'app-mfa-reset-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    PasswordModule,
    TextareaModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mfa-reset-dialog.component.html',
})
export class MfaResetDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly users = inject(UsersService);
  private readonly mfa = inject(MfaService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = input.required<boolean>();
  readonly target = input<UserResponse | null>(null);
  readonly actorMfaEnabled = input.required<boolean>();
  readonly visibleChange = output<boolean>();

  protected readonly method = signal<MfaVerificationMethod>('Authenticator');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  private readonly nowUtc = signal(Date.now());
  private readonly retryAtUtc = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    verificationCode: [''],
    reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
  });

  protected readonly rateLimited = computed(() => {
    const retryAt = this.retryAtUtc();
    return retryAt !== null && retryAt > this.nowUtc();
  });
  protected readonly retryLabel = computed(() => {
    const retryAt = this.retryAtUtc();
    return retryAt === null ? null : retryAfterLabel(retryAt, this.nowUtc());
  });

  constructor() {
    effect(() => {
      const open = this.visible();
      const factorRequired = this.actorMfaEnabled();
      if (open) {
        untracked(() => {
          this.reset();
          this.setFactorValidators(factorRequired);
        });
      } else {
        untracked(() => this.clearSensitiveState());
      }
    });

    timer(0, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.nowUtc.set(Date.now());
        const retryAt = this.retryAtUtc();
        if (retryAt !== null && retryAt <= this.nowUtc()) this.retryAtUtc.set(null);
      });

    this.destroyRef.onDestroy(() => this.clearSensitiveState());
  }

  protected selectMethod(method: MfaVerificationMethod): void {
    if (this.method() === method) return;
    this.method.set(method);
    this.form.controls.verificationCode.reset('');
    this.setFactorValidators(true);
    this.submitError.set(null);
  }

  protected isInvalid(controlName: 'currentPassword' | 'verificationCode' | 'reason'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  protected submit(): void {
    const target = this.target();
    if (!target || this.submitting() || this.rateLimited()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);
    const raw = this.form.getRawValue();
    const factorRequired = this.actorMfaEnabled();

    this.users
      .resetMfa(target.id, {
        currentPassword: raw.currentPassword,
        verificationCode: factorRequired ? raw.verificationCode.trim() : null,
        method: factorRequired ? this.method() : null,
        reason: raw.reason.trim(),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: () => {
          const usedRecoveryCode = factorRequired && this.method() === 'RecoveryCode';
          this.clearSensitiveState();
          this.visibleChange.emit(false);
          this.notifications.success(`Se reseteó el MFA de ${target.fullName}.`);
          if (usedRecoveryCode) this.mfa.loadStatus(true).subscribe({ error: () => {} });
        },
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
  }

  protected onVisibleChange(value: boolean): void {
    if (!value && this.submitting()) return;
    if (!value) this.clearSensitiveState();
    this.visibleChange.emit(value);
  }

  protected cancel(): void {
    if (this.submitting()) return;
    this.clearSensitiveState();
    this.visibleChange.emit(false);
  }

  private setFactorValidators(required: boolean): void {
    const control = this.form.controls.verificationCode;
    if (!required) {
      control.clearValidators();
    } else if (this.method() === 'Authenticator') {
      control.setValidators([Validators.required, Validators.pattern(/^\d{6}$/)]);
    } else {
      control.setValidators([Validators.required, Validators.maxLength(40)]);
    }
    control.updateValueAndValidity();
  }

  private handleError(error: HttpErrorResponse): void {
    const body = (error.error ?? {}) as BackendErrorBody;
    this.retryAtUtc.set(error.status === 429 ? retryAfterUtc(error) : null);
    if (body.errors?.length) {
      this.submitError.set(body.errors.map((item) => item.message).join(' • '));
      return;
    }
    this.submitError.set(body.message ?? 'No pudimos resetear el MFA. Probá de nuevo.');
  }

  private reset(): void {
    this.clearSensitiveState();
    this.method.set('Authenticator');
  }

  private clearSensitiveState(): void {
    this.form.reset({ currentPassword: '', verificationCode: '', reason: '' });
    this.submitError.set(null);
    this.submitting.set(false);
    this.retryAtUtc.set(null);
  }
}
