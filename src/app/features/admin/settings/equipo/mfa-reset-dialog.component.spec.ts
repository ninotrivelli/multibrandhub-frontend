import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { makeUser } from '../../../../../testing/builders';
import { MfaService } from '../../../../core/auth/mfa.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { UsersService } from '../../../../core/users/users.service';
import { MfaResetDialogComponent } from './mfa-reset-dialog.component';

describe('MfaResetDialogComponent', () => {
  let fixture: ComponentFixture<MfaResetDialogComponent>;
  let users: { resetMfa: ReturnType<typeof vi.fn> };
  let mfa: { loadStatus: ReturnType<typeof vi.fn> };
  let notifications: { success: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    users = { resetMfa: vi.fn(() => of(undefined)) };
    mfa = { loadStatus: vi.fn(() => of(null)) };
    notifications = { success: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MfaResetDialogComponent],
      providers: [
        { provide: UsersService, useValue: users },
        { provide: MfaService, useValue: mfa },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MfaResetDialogComponent);
    fixture.componentRef.setInput('target', makeUser({ id: 'admin-target', role: 'Admin' }));
    fixture.componentRef.setInput('actorMfaEnabled', false);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  });

  it('sends null method and code when the SuperAdmin actor is not enrolled', () => {
    const component = fixture.componentInstance as any;
    component.form.setValue({
      currentPassword: 'Password!123',
      verificationCode: '',
      reason: 'Perdió acceso al dispositivo corporativo.',
    });
    component.submit();

    expect(users.resetMfa).toHaveBeenCalledWith('admin-target', {
      currentPassword: 'Password!123',
      verificationCode: null,
      method: null,
      reason: 'Perdió acceso al dispositivo corporativo.',
    });
  });

  it('requires and sends the actor factor, refreshing status after a recovery code is consumed', () => {
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('actorMfaEnabled', true);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    component.selectMethod('RecoveryCode');
    component.form.setValue({
      currentPassword: 'Password!123',
      verificationCode: 'AAAA-BBBB-CCCC-DDDD',
      reason: 'Perdió acceso al dispositivo corporativo.',
    });
    component.submit();

    expect(users.resetMfa).toHaveBeenLastCalledWith('admin-target', {
      currentPassword: 'Password!123',
      verificationCode: 'AAAA-BBBB-CCCC-DDDD',
      method: 'RecoveryCode',
      reason: 'Perdió acceso al dispositivo corporativo.',
    });
    expect(mfa.loadStatus).toHaveBeenCalledWith(true);
  });

  it('requires a six-digit authenticator code when the actor has MFA enabled', () => {
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('actorMfaEnabled', true);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.form.setValue({
      currentPassword: 'Password!123',
      verificationCode: '123',
      reason: 'Perdió acceso al dispositivo corporativo.',
    });

    component.submit();

    expect(users.resetMfa).not.toHaveBeenCalled();
    expect(component.isInvalid('verificationCode')).toBe(true);

    component.form.controls.verificationCode.setValue('123456');
    component.submit();
    expect(users.resetMfa).toHaveBeenCalledWith(
      'admin-target',
      expect.objectContaining({ verificationCode: '123456', method: 'Authenticator' }),
    );
    expect(notifications.success).toHaveBeenCalledWith(expect.stringContaining('Se reseteó el MFA de'));
  });

  it('does nothing without a target and blocks duplicate or rate-limited submits', () => {
    const component = fixture.componentInstance as any;
    fixture.componentRef.setInput('target', null);
    fixture.detectChanges();
    component.submit();
    expect(users.resetMfa).not.toHaveBeenCalled();

    fixture.componentRef.setInput('target', makeUser({ id: 'admin-target' }));
    fixture.detectChanges();
    component.submitting.set(true);
    component.submit();
    expect(users.resetMfa).not.toHaveBeenCalled();

    component.submitting.set(false);
    component.retryAtUtc.set(Date.now() + 60_000);
    component.submit();
    expect(component.rateLimited()).toBe(true);
    expect(component.retryLabel()).toMatch(/^(60 s|2 min)$/);
    expect(users.resetMfa).not.toHaveBeenCalled();
  });

  it('switches between recovery and authenticator validation without resetting twice', () => {
    const component = fixture.componentInstance as any;
    component.selectMethod('RecoveryCode');
    component.form.controls.verificationCode.setValue('RECOVERY-CODE');
    expect(component.form.controls.verificationCode.valid).toBe(true);

    component.selectMethod('RecoveryCode');
    expect(component.form.controls.verificationCode.value).toBe('RECOVERY-CODE');

    component.selectMethod('Authenticator');
    expect(component.form.controls.verificationCode.value).toBe('');
    component.form.controls.verificationCode.setValue('123');
    expect(component.form.controls.verificationCode.invalid).toBe(true);
  });

  it('surfaces structured, rate-limited, and fallback reset errors', () => {
    const component = fixture.componentInstance as any;
    const fill = () =>
      component.form.setValue({
        currentPassword: 'Password!123',
        verificationCode: '',
        reason: 'Perdió acceso al dispositivo corporativo.',
      });

    users.resetMfa.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: [{ message: 'No autorizado.' }, { message: 'Revisá la clave.' }] },
          }),
      ),
    );
    fill();
    component.submit();
    expect(component.submitError()).toBe('No autorizado. • Revisá la clave.');

    users.resetMfa.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            headers: new HttpHeaders({ 'Retry-After': '30' }),
            error: { message: 'Demasiados intentos.' },
          }),
      ),
    );
    fill();
    component.submit();
    expect(component.submitError()).toBe('Demasiados intentos.');
    expect(component.rateLimited()).toBe(true);

    component.retryAtUtc.set(null);
    users.resetMfa.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, error: null })),
    );
    fill();
    component.submit();
    expect(component.submitError()).toBe('No pudimos resetear el MFA. Probá de nuevo.');
  });

  it('prevents closing while submitting and clears sensitive fields when closing is allowed', () => {
    const component = fixture.componentInstance as any;
    const emitted: boolean[] = [];
    component.visibleChange.subscribe((value: boolean) => emitted.push(value));
    component.form.controls.currentPassword.setValue('secret');

    component.submitting.set(true);
    component.onVisibleChange(false);
    component.cancel();
    expect(emitted).toEqual([]);

    component.submitting.set(false);
    component.onVisibleChange(true);
    component.cancel();
    expect(emitted).toEqual([true, false]);
    expect(component.form.controls.currentPassword.value).toBe('');
  });
});
