import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { MfaService } from '../../../../core/auth/mfa.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { MfaReauthDialogComponent } from './mfa-reauth-dialog.component';

describe('MfaReauthDialogComponent', () => {
  let fixture: ComponentFixture<MfaReauthDialogComponent>;
  let auth: { logout: ReturnType<typeof vi.fn> };
  let mfa: {
    regenerateRecoveryCodes: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
    loadStatus: ReturnType<typeof vi.fn>;
  };
  let notifications: { success: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = { logout: vi.fn() };
    mfa = {
      regenerateRecoveryCodes: vi.fn(() =>
        of({
          recoveryCodes: ['AAAA-BBBB-CCCC-DDDD'],
          enabledAtUtc: new Date().toISOString(),
          sessionInvalidated: false,
        }),
      ),
      disable: vi.fn(() => of(undefined)),
      loadStatus: vi.fn(() => of(null)),
    };
    notifications = { success: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MfaReauthDialogComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: MfaService, useValue: mfa },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MfaReauthDialogComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('mode', 'regenerate');
    fixture.detectChanges();
  });

  function fillValidForm(): void {
    (fixture.componentInstance as any).form.setValue({
      currentPassword: 'Password!123',
      verificationCode: '123456',
    });
  }

  it('shows regenerated codes while preserving the current session', () => {
    fillValidForm();
    (fixture.componentInstance as any).submit();

    expect(mfa.regenerateRecoveryCodes).toHaveBeenCalledWith({
      currentPassword: 'Password!123',
      verificationCode: '123456',
      method: 'Authenticator',
    });
    expect((fixture.componentInstance as any).recoveryCodes()).toEqual(['AAAA-BBBB-CCCC-DDDD']);
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('logs out after MFA is disabled', () => {
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('mode', 'disable');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    fillValidForm();

    (fixture.componentInstance as any).submit();

    expect(mfa.disable).toHaveBeenCalled();
    expect(notifications.success).toHaveBeenCalledWith(
      'La autenticación en dos pasos fue desactivada.',
    );
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('switches verification methods and applies the matching validation', () => {
    const component = fixture.componentInstance as any;
    component.form.controls.verificationCode.setValue('bad');
    component.submitError.set('Anterior');

    component.selectMethod('RecoveryCode');
    expect(component.method()).toBe('RecoveryCode');
    expect(component.form.controls.verificationCode.value).toBe('');
    expect(component.submitError()).toBeNull();
    component.form.controls.verificationCode.setValue('RECOVERY-CODE');
    expect(component.form.controls.verificationCode.valid).toBe(true);

    component.selectMethod('RecoveryCode');
    expect(component.form.controls.verificationCode.value).toBe('RECOVERY-CODE');

    component.selectMethod('Authenticator');
    component.form.controls.verificationCode.setValue('123');
    expect(component.form.controls.verificationCode.invalid).toBe(true);
  });

  it('marks invalid fields and blocks duplicate or rate-limited requests', () => {
    const component = fixture.componentInstance as any;
    component.submit();
    expect(component.form.controls.currentPassword.touched).toBe(true);
    expect(mfa.regenerateRecoveryCodes).not.toHaveBeenCalled();

    fillValidForm();
    component.submitting.set(true);
    component.submit();
    expect(mfa.regenerateRecoveryCodes).not.toHaveBeenCalled();

    component.submitting.set(false);
    component.retryAtUtc.set(Date.now() + 60_000);
    component.submit();
    expect(component.rateLimited()).toBe(true);
    expect(component.retryLabel()).toMatch(/^(60 s|2 min)$/);
    expect(mfa.regenerateRecoveryCodes).not.toHaveBeenCalled();
  });

  it('identifies invalid controls only after interaction', () => {
    const component = fixture.componentInstance as any;
    expect(component.isInvalid('currentPassword')).toBe(false);
    component.form.controls.currentPassword.markAsTouched();
    expect(component.isInvalid('currentPassword')).toBe(true);
    component.form.controls.currentPassword.setValue('Password!123');
    expect(component.isInvalid('currentPassword')).toBe(false);
  });

  it('surfaces structured, plain, and fallback backend errors', () => {
    const component = fixture.componentInstance as any;
    mfa.regenerateRecoveryCodes.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: [{ message: 'Código inválido.' }, { message: 'Revisalo.' }] },
          }),
      ),
    );
    fillValidForm();
    component.submit();
    expect(component.submitError()).toBe('Código inválido. • Revisalo.');

    mfa.regenerateRecoveryCodes.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            headers: new HttpHeaders({ 'Retry-After': '30' }),
            error: { message: 'Esperá antes de reintentar.' },
          }),
      ),
    );
    fillValidForm();
    component.submit();
    expect(component.submitError()).toBe('Esperá antes de reintentar.');
    expect(component.rateLimited()).toBe(true);

    component.retryAtUtc.set(null);
    mfa.regenerateRecoveryCodes.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, error: null })),
    );
    fillValidForm();
    component.submit();
    expect(component.submitError()).toBe('No pudimos completar la operación. Probá de nuevo.');
  });

  it('keeps the dialog locked while submitting or displaying recovery codes', () => {
    const component = fixture.componentInstance as any;
    const emitted: boolean[] = [];
    component.visibleChange.subscribe((value: boolean) => emitted.push(value));

    component.submitting.set(true);
    component.onVisibleChange(false);
    component.cancel();
    expect(emitted).toEqual([]);

    component.submitting.set(false);
    component.recoveryCodes.set(['CODE']);
    component.onVisibleChange(false);
    component.cancel();
    expect(emitted).toEqual([]);

    component.recoveryCodes.set([]);
    component.onVisibleChange(true);
    component.cancel();
    expect(emitted).toEqual([true, false]);
  });

  it('closes the recovery panel and refreshes MFA status even if refresh fails', () => {
    const component = fixture.componentInstance as any;
    const emitted: boolean[] = [];
    component.visibleChange.subscribe((value: boolean) => emitted.push(value));
    component.recoveryCodes.set(['CODE']);
    mfa.loadStatus.mockReturnValue(throwError(() => new Error('status unavailable')));

    component.finishRecoveryCodes();

    expect(component.recoveryCodes()).toEqual([]);
    expect(emitted).toEqual([false]);
    expect(mfa.loadStatus).toHaveBeenCalledWith(true);
  });
});
