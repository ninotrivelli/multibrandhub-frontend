import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { makeAuthSession } from '../../../../testing/builders';
import { AuthService } from '../../../core/auth/auth.service';
import { MfaVerificationComponent } from './mfa-verification.component';

describe('MfaVerificationComponent', () => {
  let fixture: ComponentFixture<MfaVerificationComponent>;
  let auth: {
    pendingMfaExpiresAtUtc: () => string;
    verifyMfa: ReturnType<typeof vi.fn>;
    clearPendingMfaChallenge: ReturnType<typeof vi.fn>;
    homePathFor: ReturnType<typeof vi.fn>;
  };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let pendingExpiresAt: string;

  beforeEach(async () => {
    pendingExpiresAt = new Date(Date.now() + 300_000).toISOString();
    auth = {
      pendingMfaExpiresAtUtc: () => pendingExpiresAt,
      verifyMfa: vi.fn(() => of(makeAuthSession())),
      clearPendingMfaChallenge: vi.fn(),
      homePathFor: vi.fn(() => '/admin'),
    };
    router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };

    await TestBed.configureTestingModule({
      imports: [MfaVerificationComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MfaVerificationComponent);
    fixture.detectChanges();
  });

  it('verifies Authenticator codes without exposing the challenge to the component', () => {
    const component = fixture.componentInstance as any;
    component.form.setValue({ code: '123456' });
    component.submit();

    expect(auth.verifyMfa).toHaveBeenCalledWith('123456', 'Authenticator');
    expect(auth.homePathFor).toHaveBeenCalledWith('Admin');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('accepts pasted recovery codes and clears sensitive state when destroyed', () => {
    const component = fixture.componentInstance as any;
    component.selectMethod('RecoveryCode');
    component.form.setValue({ code: 'AAAA-BBBB-CCCC-DDDD' });
    component.submit();

    expect(auth.verifyMfa).toHaveBeenCalledWith('AAAA-BBBB-CCCC-DDDD', 'RecoveryCode');

    fixture.destroy();
    expect(auth.clearPendingMfaChallenge).toHaveBeenCalled();
  });

  it('returns to login after explicitly clearing the challenge', async () => {
    (fixture.componentInstance as any).returnToLogin();

    expect(auth.clearPendingMfaChallenge).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('switches methods, resets stale errors, and applies matching validators', async () => {
    const component = fixture.componentInstance as any;
    component.form.controls.code.setValue('123');
    component.submitError.set('Anterior');

    component.selectMethod('RecoveryCode');
    expect(component.method()).toBe('RecoveryCode');
    expect(component.form.controls.code.value).toBe('');
    expect(component.submitError()).toBeNull();
    component.form.controls.code.setValue('RECOVERY-CODE');
    expect(component.form.controls.code.valid).toBe(true);

    component.selectMethod('RecoveryCode');
    expect(component.form.controls.code.value).toBe('RECOVERY-CODE');

    component.selectMethod('Authenticator');
    component.form.controls.code.setValue('123');
    expect(component.form.controls.code.invalid).toBe(true);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });

  it('marks invalid input and blocks submitting, expired, and rate-limited attempts', () => {
    const component = fixture.componentInstance as any;
    component.submit();
    expect(component.form.controls.code.touched).toBe(true);
    expect(component.isInvalid()).toBe(true);
    expect(auth.verifyMfa).not.toHaveBeenCalled();

    component.form.controls.code.setValue('123456');
    expect(component.isInvalid()).toBe(false);
    component.submitting.set(true);
    component.submit();
    component.submitting.set(false);
    component.expired.set(true);
    component.submit();
    component.expired.set(false);
    component.retryAtUtc.set(Date.now() + 30_000);
    component.submit();

    expect(component.rateLimited()).toBe(true);
    expect(component.retryLabel()).toMatch(/^3[0-1] s$/);
    expect(auth.verifyMfa).not.toHaveBeenCalled();
  });

  it('formats remaining challenge time and expires an invalid challenge immediately', async () => {
    const component = fixture.componentInstance as any;
    expect(component.remainingSeconds()).toBeGreaterThan(0);
    expect(component.remainingLabel()).toMatch(/^\d{2}:\d{2}$/);

    fixture.destroy();
    pendingExpiresAt = 'not-a-date';
    fixture = TestBed.createComponent(MfaVerificationComponent);
    fixture.detectChanges();
    const invalidExpiryComponent = fixture.componentInstance as any;
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(invalidExpiryComponent.remainingSeconds()).toBe(0);
    expect(invalidExpiryComponent.remainingLabel()).toBe('00:00');
    expect(invalidExpiryComponent.expired()).toBe(true);
    expect(auth.clearPendingMfaChallenge).toHaveBeenCalled();
  });

  it('shows structured verification errors', () => {
    const component = fixture.componentInstance as any;
    auth.verifyMfa.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: [{ message: 'Código incorrecto.' }, { message: 'Reintentá.' }] },
          }),
      ),
    );
    component.form.setValue({ code: '123456' });

    component.submit();
    fixture.detectChanges();

    expect(component.submitting()).toBe(false);
    expect(component.submitError()).toBe('Código incorrecto. • Reintentá.');
    expect(fixture.nativeElement.textContent).toContain('Código incorrecto.');
  });

  it('honors Retry-After and uses plain or fallback error messages', () => {
    const component = fixture.componentInstance as any;
    auth.verifyMfa.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            headers: new HttpHeaders({ 'Retry-After': '45' }),
            error: { message: 'Demasiados intentos.' },
          }),
      ),
    );
    component.form.setValue({ code: '123456' });
    component.submit();
    expect(component.submitError()).toBe('Demasiados intentos.');
    expect(component.rateLimited()).toBe(true);

    component.retryAtUtc.set(null);
    auth.verifyMfa.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, error: null })),
    );
    component.form.setValue({ code: '123456' });
    component.submit();
    expect(component.submitError()).toBe(
      'No pudimos verificar el segundo factor. Volvé a intentarlo.',
    );
  });
});
