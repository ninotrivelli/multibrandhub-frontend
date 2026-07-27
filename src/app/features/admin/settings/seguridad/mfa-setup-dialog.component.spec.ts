import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

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

  beforeEach(async () => {
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

    await TestBed.configureTestingModule({
      imports: [MfaSetupDialogComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: MfaService, useValue: mfa },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MfaSetupDialogComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
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
});
