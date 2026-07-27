import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

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

    await TestBed.configureTestingModule({
      imports: [MfaReauthDialogComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: MfaService, useValue: mfa },
        { provide: NotificationService, useValue: { success: vi.fn() } },
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
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});
