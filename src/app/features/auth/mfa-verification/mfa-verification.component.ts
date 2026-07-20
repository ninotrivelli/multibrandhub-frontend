import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, timer } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../../../core/auth/auth.service';
import { MfaVerificationMethod } from '../../../core/auth/auth.types';
import { retryAfterLabel, retryAfterUtc } from '../../../core/http/retry-after';

interface BackendErrorBody {
  message?: string;
  errors?: Array<{ message: string }>;
}

@Component({
  selector: 'app-mfa-verification',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mfa-verification.component.html',
})
export class MfaVerificationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');

  protected readonly method = signal<MfaVerificationMethod>('Authenticator');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly expired = signal(false);
  private readonly nowUtc = signal(Date.now());
  private readonly retryAtUtc = signal<number | null>(null);
  private readonly expiresAtMs = Date.parse(this.auth.pendingMfaExpiresAtUtc() ?? '');

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  protected readonly remainingSeconds = computed(() =>
    Number.isFinite(this.expiresAtMs)
      ? Math.max(0, Math.ceil((this.expiresAtMs - this.nowUtc()) / 1000))
      : 0,
  );
  protected readonly remainingLabel = computed(() => {
    const remaining = this.remainingSeconds();
    const minutes = Math.floor(remaining / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (remaining % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
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
    timer(0, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.nowUtc.set(Date.now());
        const retryAt = this.retryAtUtc();
        if (retryAt !== null && retryAt <= this.nowUtc()) this.retryAtUtc.set(null);

        if (!this.expired() && this.remainingSeconds() === 0) {
          this.expireChallenge();
        }
      });

    this.destroyRef.onDestroy(() => {
      this.form.reset({ code: '' });
      this.auth.clearPendingMfaChallenge();
    });
  }

  protected selectMethod(method: MfaVerificationMethod): void {
    if (this.method() === method) return;
    this.method.set(method);
    const code = this.form.controls.code;
    code.reset('');
    code.setValidators(
      method === 'Authenticator'
        ? [Validators.required, Validators.pattern(/^\d{6}$/)]
        : [Validators.required, Validators.maxLength(40)],
    );
    code.updateValueAndValidity();
    this.submitError.set(null);
    queueMicrotask(() => this.codeInput()?.nativeElement.focus());
  }

  protected isInvalid(): boolean {
    const control = this.form.controls.code;
    return control.invalid && (control.touched || control.dirty);
  }

  protected submit(): void {
    if (this.submitting() || this.expired() || this.rateLimited()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);
    const code = this.form.getRawValue().code.trim();

    this.auth
      .verifyMfa(code, this.method())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: (session) => {
          this.form.reset({ code: '' });
          void this.router.navigateByUrl(this.auth.homePathFor(session.user.role));
        },
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
  }

  protected returnToLogin(): void {
    this.auth.clearPendingMfaChallenge();
    this.form.reset({ code: '' });
    void this.router.navigateByUrl('/login');
  }

  private expireChallenge(): void {
    this.expired.set(true);
    this.auth.clearPendingMfaChallenge();
    this.form.reset({ code: '' });
    this.submitError.set(null);
  }

  private handleError(error: HttpErrorResponse): void {
    const body = (error.error ?? {}) as BackendErrorBody;
    this.retryAtUtc.set(error.status === 429 ? retryAfterUtc(error) : null);
    if (body.errors?.length) {
      this.submitError.set(body.errors.map((item) => item.message).join(' • '));
      return;
    }
    this.submitError.set(
      body.message ?? 'No pudimos verificar el segundo factor. Volvé a intentarlo.',
    );
  }
}
