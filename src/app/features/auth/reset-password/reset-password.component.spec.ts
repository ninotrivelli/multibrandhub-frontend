import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let token: string | null;
  let auth: {
    resetForgottenPassword: ReturnType<typeof vi.fn>;
    clearSession: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    token = 'email-token';
    auth = {
      resetForgottenPassword: vi.fn(() => of(undefined)),
      clearSession: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return { queryParamMap: convertToParamMap(token === null ? {} : { token }) };
            },
          },
        },
      ],
    });

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  function create(): { fixture: ReturnType<typeof TestBed.createComponent>; component: any } {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance as any };
  }

  it('captures the token once and replaces the URL without query params', () => {
    const { component } = create();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/reset-password', { replaceUrl: true });
    expect(component.resetToken()).toBe('email-token');
    expect(localStorage.getItem('email-token')).toBeNull();
    expect(sessionStorage.getItem('email-token')).toBeNull();
  });

  it('shows an invalid-link state when the token is missing', () => {
    token = null;
    const { fixture, component } = create();

    expect(component.state()).toBe('missingToken');
    expect(fixture.nativeElement.textContent).toContain('El enlace de recuperación no es válido.');
    expect(auth.resetForgottenPassword).not.toHaveBeenCalled();
  });

  it('enforces password length, number, and confirmation rules', () => {
    const { component } = create();

    component.form.patchValue({ newPassword: 'SinNumero', confirmPassword: 'SinNumero' });
    expect(component.form.controls.newPassword.hasError('pattern')).toBe(true);

    component.form.patchValue({ newPassword: 'A1c', confirmPassword: 'A1c' });
    expect(component.form.controls.newPassword.hasError('minlength')).toBe(true);

    const tooLong = `A1${'x'.repeat(39)}`;
    component.form.patchValue({ newPassword: tooLong, confirmPassword: tooLong });
    expect(component.form.controls.newPassword.hasError('maxlength')).toBe(true);

    component.form.patchValue({ newPassword: 'Nueva1234', confirmPassword: 'Otra1234' });
    expect(component.form.hasError('passwordMismatch')).toBe(true);
  });

  it('clears any local session after a successful public reset', () => {
    const { fixture, component } = create();
    component.form.patchValue({ newPassword: 'Nueva1234', confirmPassword: 'Nueva1234' });

    component.submit();
    fixture.detectChanges();

    expect(auth.resetForgottenPassword).toHaveBeenCalledWith('email-token', 'Nueva1234');
    expect(auth.clearSession).toHaveBeenCalledOnce();
    expect(component.resetToken()).toBeNull();
    expect(component.state()).toBe('success');
    expect(fixture.nativeElement.textContent).toContain('Volver a iniciar sesión');
  });

  it('moves to the invalid-token state for an expired or used token', () => {
    auth.resetForgottenPassword.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'El enlace de recuperación no es válido o ya venció.' },
          }),
      ),
    );
    const { fixture, component } = create();
    component.form.patchValue({ newPassword: 'Nueva1234', confirmPassword: 'Nueva1234' });

    component.submit();
    fixture.detectChanges();

    expect(component.state()).toBe('invalidToken');
    expect(component.resetToken()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Solicitar otro enlace');
  });

  it('keeps the token and shows 429 inline so the user can retry', () => {
    auth.resetForgottenPassword.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            error: {
              message: 'Demasiados intentos de recuperación. Intente nuevamente en unos minutos.',
            },
          }),
      ),
    );
    const { fixture, component } = create();
    component.form.patchValue({ newPassword: 'Nueva1234', confirmPassword: 'Nueva1234' });

    component.submit();
    fixture.detectChanges();

    expect(component.state()).toBe('form');
    expect(component.resetToken()).toBe('email-token');
    expect(fixture.nativeElement.textContent).toContain('Demasiados intentos de recuperación.');
  });

  it('blocks duplicate reset requests while one is pending', () => {
    const pending = new Subject<void>();
    auth.resetForgottenPassword.mockReturnValue(pending);
    const { component } = create();
    component.form.patchValue({ newPassword: 'Nueva1234', confirmPassword: 'Nueva1234' });

    component.submit();
    component.submit();

    expect(auth.resetForgottenPassword).toHaveBeenCalledOnce();
    pending.complete();
  });
});
