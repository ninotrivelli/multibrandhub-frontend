import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../../../core/auth/auth.service';
import { LoadingService } from '../../../core/loading/loading.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, PasswordModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-900 p-4">
      <section class="w-full max-w-md bg-surface-0 dark:bg-surface-800 rounded-2xl shadow-md border border-surface-200 dark:border-surface-700 p-8">
        <header class="mb-6 text-center">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0">MultiBrandHub</h1>
          <p class="text-surface-600 dark:text-surface-300 text-sm mt-1">Ingresá con tu cuenta</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label for="email" class="text-sm font-medium text-surface-700 dark:text-surface-200">Email</label>
            <input
              pInputText
              id="email"
              type="email"
              formControlName="email"
              autocomplete="email"
              [invalid]="isInvalid('email')"
              placeholder="tu@correo.com"
              fluid
            />
            @if (isInvalid('email')) {
              @if (form.controls.email.hasError('required')) {
                <p-message severity="error" size="small" variant="simple">El email es obligatorio.</p-message>
              } @else if (form.controls.email.hasError('email')) {
                <p-message severity="error" size="small" variant="simple">Ingresá un email válido.</p-message>
              }
            }
          </div>

          <div class="flex flex-col gap-1">
            <label for="password" class="text-sm font-medium text-surface-700 dark:text-surface-200">Contraseña</label>
            <p-password
              inputId="password"
              formControlName="password"
              [feedback]="false"
              [toggleMask]="true"
              autocomplete="current-password"
              [invalid]="isInvalid('password')"
              fluid
            />
            @if (isInvalid('password') && form.controls.password.hasError('required')) {
              <p-message severity="error" size="small" variant="simple">La contraseña es obligatoria.</p-message>
            }
          </div>

          @if (loginError()) {
            <p-message severity="error" variant="outlined" closable="false">{{ loginError() }}</p-message>
          }

          <button
            pButton
            type="submit"
            [disabled]="submitting()"
            [loading]="submitting()"
            label="Ingresar"
            class="w-full"
          ></button>
        </form>
      </section>
    </main>
  `
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);

  protected readonly submitting = signal(false);
  protected readonly loginError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

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
      next: (session) => {
        this.submitting.set(false);
        this.loading.stop();
        this.router.navigateByUrl(this.auth.homePathFor(session.user.role));
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.loading.stop();
        const message =
          err.status === 401
            ? 'Credenciales inválidas. Revisá email y contraseña.'
            : ((err.error?.message as string | undefined) ?? 'No se pudo iniciar sesión. Probá de nuevo.');
        this.loginError.set(message);
      }
    });
  }
}
