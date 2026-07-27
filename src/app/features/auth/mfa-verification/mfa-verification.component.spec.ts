import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

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

  beforeEach(async () => {
    auth = {
      pendingMfaExpiresAtUtc: () => new Date(Date.now() + 300_000).toISOString(),
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
});
