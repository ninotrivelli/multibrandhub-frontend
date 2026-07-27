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
import { Router } from '@angular/router';
import { finalize, timer } from 'rxjs';
import { renderSVG } from 'uqr';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { Copy, LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../../../core/auth/auth.service';
import { MfaService } from '../../../../core/auth/mfa.service';
import { retryAfterLabel, retryAfterUtc } from '../../../../core/http/retry-after';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { RecoveryCodesPanelComponent } from './recovery-codes-panel.component';

type SetupStep = 'password' | 'setup' | 'recovery';

interface BackendErrorBody {
  message?: string;
  errors?: Array<{ message: string }>;
}

@Component({
  selector: 'app-mfa-setup-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    PasswordModule,
    LucideAngularModule,
    RecoveryCodesPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mfa-setup-dialog.component.html',
})
export class MfaSetupDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly mfa = inject(MfaService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = input.required<boolean>();
  readonly visibleChange = output<boolean>();

  protected readonly icons = { Copy };
  protected readonly step = signal<SetupStep>('password');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly manualEntryKey = signal<string | null>(null);
  protected readonly qrUrl = signal<string | null>(null);
  protected readonly recoveryCodes = signal<readonly string[]>([]);
  protected readonly sessionInvalidated = signal(true);
  private readonly setupExpiresAtMs = signal<number | null>(null);
  private readonly nowUtc = signal(Date.now());
  private readonly retryAtUtc = signal<number | null>(null);

  protected readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
  });
  protected readonly codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  protected readonly remainingLabel = computed(() => {
    const expiresAt = this.setupExpiresAtMs();
    if (expiresAt === null) return '00:00';
    const remaining = Math.max(0, Math.ceil((expiresAt - this.nowUtc()) / 1000));
    return `${Math.floor(remaining / 60)
      .toString()
      .padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;
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
      untracked(() => {
        if (open) this.resetAll();
        else this.clearSensitiveState();
      });
    });

    timer(0, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.nowUtc.set(Date.now());
        const retryAt = this.retryAtUtc();
        if (retryAt !== null && retryAt <= this.nowUtc()) this.retryAtUtc.set(null);

        const expiresAt = this.setupExpiresAtMs();
        if (this.step() === 'setup' && expiresAt !== null && expiresAt <= this.nowUtc()) {
          this.clearSetupMaterial();
          this.step.set('password');
          this.submitError.set('El proceso de activación venció. Empezá nuevamente.');
        }
      });

    this.destroyRef.onDestroy(() => this.clearSensitiveState());
  }

  protected startSetup(): void {
    if (this.passwordForm.invalid || this.submitting() || this.rateLimited()) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);
    const password = this.passwordForm.getRawValue().currentPassword;

    this.mfa
      .startSetup(password)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.clearSetupMaterial();
          const svg = renderSVG(response.otpAuthUri, {
            ecc: 'M',
            border: 4,
            pixelSize: 6,
          });
          const blob = new Blob([svg], { type: 'image/svg+xml' });
          this.qrUrl.set(URL.createObjectURL(blob));
          this.manualEntryKey.set(response.manualEntryKey);
          this.setupExpiresAtMs.set(Date.parse(response.expiresAtUtc));
          this.passwordForm.reset({ currentPassword: '' });
          this.step.set('setup');
        },
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
  }

  protected confirmSetup(): void {
    if (this.codeForm.invalid || this.submitting() || this.rateLimited()) {
      this.codeForm.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);
    const code = this.codeForm.getRawValue().code;

    this.mfa
      .confirmSetup(code)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.recoveryCodes.set([...response.recoveryCodes]);
          this.sessionInvalidated.set(response.sessionInvalidated);
          this.clearSetupMaterial();
          this.codeForm.reset({ code: '' });
          this.auth.clearSession();
          this.step.set('recovery');
        },
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
  }

  protected async copyManualKey(): Promise<void> {
    const key = this.manualEntryKey();
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      this.notifications.success('Clave manual copiada.');
    } catch {
      this.notifications.error('No pudimos copiar la clave manual.');
    }
  }

  protected onVisibleChange(value: boolean): void {
    if (!value && (this.submitting() || this.step() === 'recovery')) return;
    if (!value) this.clearSensitiveState();
    this.visibleChange.emit(value);
  }

  protected cancel(): void {
    if (this.submitting() || this.step() === 'recovery') return;
    this.clearSensitiveState();
    this.visibleChange.emit(false);
  }

  protected finishRecoveryCodes(): void {
    this.recoveryCodes.set([]);
    this.visibleChange.emit(false);
    void this.router.navigateByUrl('/login', { replaceUrl: true });
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

  private resetAll(): void {
    this.clearSensitiveState();
    this.step.set('password');
    this.sessionInvalidated.set(true);
  }

  private clearSensitiveState(): void {
    this.clearSetupMaterial();
    this.recoveryCodes.set([]);
    this.passwordForm.reset({ currentPassword: '' });
    this.codeForm.reset({ code: '' });
    this.submitError.set(null);
    this.submitting.set(false);
    this.retryAtUtc.set(null);
  }

  private clearSetupMaterial(): void {
    const currentQrUrl = this.qrUrl();
    if (currentQrUrl) URL.revokeObjectURL(currentQrUrl);
    this.qrUrl.set(null);
    this.manualEntryKey.set(null);
    this.setupExpiresAtMs.set(null);
  }
}
