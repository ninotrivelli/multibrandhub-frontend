import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { MfaService } from '../../../../core/auth/mfa.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { MfaSetupDialogComponent } from './mfa-setup-dialog.component';

describe('MfaSetupDialogComponent', () => {
  let fixture: ComponentFixture<MfaSetupDialogComponent>;
  let auth: { clearSession: ReturnType<typeof vi.fn> };
  let mfa: {
    startSetup: ReturnType<typeof vi.fn>;
    confirmSetup: ReturnType<typeof vi.fn>;
  };
  let notifications: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let originalClipboard: PropertyDescriptor | undefined;

  beforeEach(async () => {
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mfa-qr');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    auth = { clearSession: vi.fn() };
    mfa = {
      startSetup: vi.fn(() =>
        of({
          manualEntryKey: 'JBSWY3DPEHPK3PXP',
          otpAuthUri: 'otpauth://totp/MultiBrandHub:test?secret=JBSWY3DPEHPK3PXP',
          expiresAtUtc: new Date(Date.now() + 600_000).toISOString(),
        }),
      ),
      confirmSetup: vi.fn(() =>
        of({
          recoveryCodes: ['AAAA-BBBB-CCCC-DDDD'],
          enabledAtUtc: new Date().toISOString(),
          sessionInvalidated: true,
        }),
      ),
    };
    notifications = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MfaSetupDialogComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: MfaService, useValue: mfa },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MfaSetupDialogComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
    vi.restoreAllMocks();
  });

  it('generates the QR locally, drops setup material after confirmation, and clears the JWT', () => {
    const component = fixture.componentInstance as any;
    component.passwordForm.setValue({ currentPassword: 'Password!123' });
    component.startSetup();

    expect(mfa.startSetup).toHaveBeenCalledWith('Password!123');
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(component.qrUrl()).toBe('blob:mfa-qr');
    expect(component.manualEntryKey()).toBe('JBSWY3DPEHPK3PXP');

    component.codeForm.setValue({ code: '123456' });
    component.confirmSetup();

    expect(mfa.confirmSetup).toHaveBeenCalledWith('123456');
    expect(auth.clearSession).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mfa-qr');
    expect(component.manualEntryKey()).toBeNull();
    expect(component.recoveryCodes()).toEqual(['AAAA-BBBB-CCCC-DDDD']);
  });

  it('cleans all sensitive values when the dialog is abandoned', () => {
    const component = fixture.componentInstance as any;
    component.passwordForm.setValue({ currentPassword: 'Password!123' });
    component.startSetup();

    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();

    expect(component.qrUrl()).toBeNull();
    expect(component.manualEntryKey()).toBeNull();
    expect(component.passwordForm.getRawValue().currentPassword).toBe('');
    expect(component.recoveryCodes()).toEqual([]);
  });

  it('navigates to login only after the recovery-code acknowledgment step finishes', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl');

    (fixture.componentInstance as any).finishRecoveryCodes();

    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('marks invalid forms and blocks duplicate or rate-limited submissions', () => {
    const component = fixture.componentInstance as any;

    component.startSetup();
    expect(component.passwordForm.controls.currentPassword.touched).toBe(true);
    expect(mfa.startSetup).not.toHaveBeenCalled();

    component.passwordForm.setValue({ currentPassword: 'Password!123' });
    component.submitting.set(true);
    component.startSetup();
    expect(mfa.startSetup).not.toHaveBeenCalled();

    component.submitting.set(false);
    component.retryAtUtc.set(Date.now() + 30_000);
    component.startSetup();
    expect(component.rateLimited()).toBe(true);
    expect(mfa.startSetup).not.toHaveBeenCalled();

    component.confirmSetup();
    expect(component.codeForm.controls.code.touched).toBe(true);
    expect(mfa.confirmSetup).not.toHaveBeenCalled();
  });

  it('formats setup expiry and retry countdown labels', () => {
    const component = fixture.componentInstance as any;
    const now = Date.now();
    component.nowUtc.set(now);

    expect(component.remainingLabel()).toBe('00:00');
    expect(component.retryLabel()).toBeNull();

    component.setupExpiresAtMs.set(now + 61_000);
    component.retryAtUtc.set(now + 90_000);
    expect(component.remainingLabel()).toBe('01:01');
    expect(component.retryLabel()).toBe('2 min');

    component.retryAtUtc.set(now + 12_000);
    expect(component.retryLabel()).toBe('12 s');
  });

  it('shows field errors returned by the backend', () => {
    const component = fixture.componentInstance as any;
    mfa.startSetup.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              errors: [{ message: 'Contraseña incorrecta.' }, { message: 'Intentá nuevamente.' }],
            },
          }),
      ),
    );
    component.passwordForm.setValue({ currentPassword: 'wrong' });

    component.startSetup();
    fixture.detectChanges();

    expect(component.submitting()).toBe(false);
    expect(component.submitError()).toBe('Contraseña incorrecta. • Intentá nuevamente.');
    expect(fixture.nativeElement.textContent).toContain('Contraseña incorrecta.');
  });

  it('uses the backend message and activates Retry-After after a 429 response', () => {
    const component = fixture.componentInstance as any;
    mfa.confirmSetup.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            headers: new HttpHeaders({ 'Retry-After': '45' }),
            error: { message: 'Demasiados intentos.' },
          }),
      ),
    );
    component.codeForm.setValue({ code: '123456' });

    component.confirmSetup();
    fixture.detectChanges();

    expect(component.submitError()).toBe('Demasiados intentos.');
    expect(component.rateLimited()).toBe(true);
    expect(component.retryLabel()).toMatch(/^4[5-6] s$/);
    expect(fixture.nativeElement.textContent).toContain('Podés volver a intentar en');
  });

  it('falls back to a generic message for an unstructured backend error', () => {
    const component = fixture.componentInstance as any;
    mfa.startSetup.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: null })),
    );
    component.passwordForm.setValue({ currentPassword: 'Password!123' });

    component.startSetup();

    expect(component.submitError()).toBe('No pudimos completar la operación. Probá de nuevo.');
    expect(component.rateLimited()).toBe(false);
  });

  it('copies the manual key and reports clipboard success or failure', async () => {
    const component = fixture.componentInstance as any;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await component.copyManualKey();
    expect(writeText).not.toHaveBeenCalled();

    component.manualEntryKey.set('SECRET-KEY');
    await component.copyManualKey();
    expect(writeText).toHaveBeenCalledWith('SECRET-KEY');
    expect(notifications.success).toHaveBeenCalledWith('Clave manual copiada.');

    writeText.mockRejectedValueOnce(new Error('clipboard denied'));
    await component.copyManualKey();
    expect(notifications.error).toHaveBeenCalledWith('No pudimos copiar la clave manual.');
  });

  it('prevents closing during submission and throughout recovery-code acknowledgment', () => {
    const component = fixture.componentInstance as any;
    const emitted: boolean[] = [];
    component.visibleChange.subscribe((value: boolean) => emitted.push(value));

    component.submitting.set(true);
    component.onVisibleChange(false);
    component.cancel();
    expect(emitted).toEqual([]);

    component.submitting.set(false);
    component.step.set('recovery');
    component.onVisibleChange(false);
    component.cancel();
    expect(emitted).toEqual([]);

    component.step.set('password');
    component.onVisibleChange(true);
    component.cancel();
    expect(emitted).toEqual([true, false]);
  });
});
