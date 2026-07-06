import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let auth: { requestPasswordReset: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();
    auth = { requestPasswordReset: vi.fn(() => of(undefined)) };
    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  it('validates the email before sending a request', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.submit();
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();
    expect(component.form.controls.email.hasError('required')).toBe(true);

    component.form.controls.email.setValue('invalid-email');
    expect(component.form.controls.email.hasError('email')).toBe(true);

    component.form.controls.email.setValue(`${'a'.repeat(190)}@example.com`);
    expect(component.form.controls.email.hasError('maxlength')).toBe(true);
  });

  it('always shows the generic success response after an accepted request', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.form.controls.email.setValue('usuario@correo.com');
    component.submit();
    fixture.detectChanges();

    expect(auth.requestPasswordReset).toHaveBeenCalledWith('usuario@correo.com');
    expect(fixture.nativeElement.textContent).toContain(
      'Si existe una cuenta activa con ese email, te enviamos un enlace para recuperar tu contraseña.',
    );
  });

  it('shows rate-limit errors inline and blocks duplicate submissions', () => {
    const pending = new Subject<void>();
    auth.requestPasswordReset.mockReturnValue(pending);
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.form.controls.email.setValue('usuario@correo.com');
    component.submit();
    component.submit();
    expect(auth.requestPasswordReset).toHaveBeenCalledOnce();

    pending.error(
      new HttpErrorResponse({
        status: 429,
        error: {
          message: 'Demasiados intentos de recuperación. Intente nuevamente en unos minutos.',
        },
      }),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Demasiados intentos de recuperación.');
  });

  it('shows backend validation errors inline', () => {
    auth.requestPasswordReset.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: [{ property: 'Email', message: 'El email no es válido.' }] },
          }),
      ),
    );
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.form.controls.email.setValue('usuario@correo.com');
    component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('El email no es válido.');
  });
});
