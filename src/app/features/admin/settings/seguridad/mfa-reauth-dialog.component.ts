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

import { AuthService } from '../../../../core/auth/auth.service';
import { MfaVerificationMethod } from '../../../../core/auth/auth.types';
import { MfaService } from '../../../../core/auth/mfa.service';
import { retryAfterLabel, retryAfterUtc } from '../../../../core/http/retry-after';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { RecoveryCodesPanelComponent } from './recovery-codes-panel.component';

export type MfaReauthMode = 'regenerate' | 'disable';

interface BackendErrorBody {
  message?: string;
  errors?: Array<{ message: string }>;
}

@Component({
  selector: 'app-mfa-reauth-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    PasswordModule,
    RecoveryCodesPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mfa-reauth-dialog.component.html',
})
export class MfaReauthDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly mfa = inject(MfaService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = input.required<boolean>();
  readonly mode = input.required<MfaReauthMode>();
  readonly visibleChange = output<boolean>();

  protected readonly method = signal<MfaVerificationMethod>('Authenticator');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly recoveryCodes = signal<readonly string[]>([]);
  private readonly nowUtc = signal(Date.now());
  private readonly retryAtUtc = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    verificationCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  protected readonly showingCodes = computed(() => this.recoveryCodes().length > 0);
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
      if (open) untracked(() => this.reset());
      else untracked(() => this.clearSensitiveState());
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
    const control = this.form.controls.verificationCode;
    control.reset('');
    control.setValidators(
      method === 'Authenticator'
        ? [Validators.required, Validators.pattern(/^\d{6}$/)]
        : [Validators.required, Validators.maxLength(40)],
    );
    control.updateValueAndValidity();
    this.submitError.set(null);
  }

  protected isInvalid(controlName: 'currentPassword' | 'verificationCode'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting() || this.rateLimited()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);
    const raw = this.form.getRawValue();
    const request = {
      currentPassword: raw.currentPassword,
      verificationCode: raw.verificationCode.trim(),
      method: this.method(),
    };

    if (this.mode() === 'regenerate') {
      this.mfa
        .regenerateRecoveryCodes(request)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => this.submitting.set(false)),
        )
        .subscribe({
          next: (response) => {
            this.form.reset({ currentPassword: '', verificationCode: '' });
            this.recoveryCodes.set([...response.recoveryCodes]);
          },
          error: (error: HttpErrorResponse) => this.handleError(error),
        });
      return;
    }

    this.mfa
      .disable(request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: () => {
          this.form.reset({ currentPassword: '', verificationCode: '' });
          this.notifications.success('La autenticación en dos pasos fue desactivada.');
          this.clearSensitiveState();
          this.visibleChange.emit(false);
          this.auth.logout();
        },
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
  }

  protected finishRecoveryCodes(): void {
    this.recoveryCodes.set([]);
    this.visibleChange.emit(false);
    this.mfa.loadStatus(true).subscribe({ error: () => {} });
  }

  protected onVisibleChange(value: boolean): void {
    if (!value && (this.submitting() || this.showingCodes())) return;
    if (!value) this.clearSensitiveState();
    this.visibleChange.emit(value);
  }

  protected cancel(): void {
    if (this.submitting() || this.showingCodes()) return;
    this.clearSensitiveState();
    this.visibleChange.emit(false);
  }

  private handleError(error: HttpErrorResponse): void {
    const body = (error.error ?? {}) as BackendErrorBody;
    this.retryAtUtc.set(error.status === 429 ? retryAfterUtc(error) : null);
    if (body.errors?.length) {
      this.submitError.set(body.errors.map((item) => item.message).join(' • '));
      return;
    }
    this.submitError.set(body.message ?? 'No pudimos completar la operación. Probá de nuevo.');
  }

  private reset(): void {
    this.clearSensitiveState();
    this.method.set('Authenticator');
    this.updateVerificationValidators();
  }

  private clearSensitiveState(): void {
    this.form.reset({ currentPassword: '', verificationCode: '' });
    this.recoveryCodes.set([]);
    this.submitError.set(null);
    this.submitting.set(false);
    this.retryAtUtc.set(null);
  }

  private updateVerificationValidators(): void {
    this.form.controls.verificationCode.setValidators([
      Validators.required,
      Validators.pattern(/^\d{6}$/),
    ]);
    this.form.controls.verificationCode.updateValueAndValidity();
  }
}
