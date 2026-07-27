import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { timer } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../../../core/auth/auth.service';
import { retryAfterLabel, retryAfterUtc } from '../../../core/http/retry-after';
import { LoadingService } from '../../../core/loading/loading.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);

  protected readonly submitting = signal(false);
  protected readonly loginError = signal<string | null>(null);
  private readonly retryAtUtc = signal<number | null>(null);
  private readonly nowUtc = signal(Date.now());
  protected readonly rateLimited = computed(() => {
    const retryAt = this.retryAtUtc();
    return retryAt !== null && retryAt > this.nowUtc();
  });
  protected readonly retryLabel = computed(() => {
    const retryAt = this.retryAtUtc();
    return retryAt === null ? null : retryAfterLabel(retryAt, this.nowUtc());
  });

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    timer(0, 1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.nowUtc.set(Date.now());
        const retryAt = this.retryAtUtc();
        if (retryAt !== null && retryAt <= this.nowUtc()) this.retryAtUtc.set(null);
      });
  }

  protected isInvalid(controlName: 'email' | 'password'): boolean {
    const c = this.form.controls[controlName];
    return c.invalid && (c.touched || c.dirty);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loginError.set(null);
    this.submitting.set(true);
    this.loading.start();

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (outcome) => {
        this.submitting.set(false);
        this.loading.stop();
        this.form.controls.password.reset('');
        if (outcome.kind === 'mfaRequired') {
          void this.router.navigateByUrl('/login/mfa');
          return;
        }
        void this.router.navigateByUrl(this.auth.homePathFor(outcome.session.user.role));
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.loading.stop();
        this.retryAtUtc.set(err.status === 429 ? retryAfterUtc(err) : null);
        const message =
          err.status === 401
            ? 'Credenciales inválidas. Revisá email y contraseña.'
            : ((err.error?.message as string | undefined) ??
              'No se pudo iniciar sesión. Probá de nuevo.');
        this.loginError.set(message);
      },
    });
  }
}
