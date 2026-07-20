import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeUser } from '../../../../../testing/builders';
import { MfaService } from '../../../../core/auth/mfa.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { UsersService } from '../../../../core/users/users.service';
import { MfaResetDialogComponent } from './mfa-reset-dialog.component';

describe('MfaResetDialogComponent', () => {
  let fixture: ComponentFixture<MfaResetDialogComponent>;
  let users: { resetMfa: ReturnType<typeof vi.fn> };
  let mfa: { loadStatus: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    users = { resetMfa: vi.fn(() => of(undefined)) };
    mfa = { loadStatus: vi.fn(() => of(null)) };

    await TestBed.configureTestingModule({
      imports: [MfaResetDialogComponent],
      providers: [
        { provide: UsersService, useValue: users },
        { provide: MfaService, useValue: mfa },
        { provide: NotificationService, useValue: { success: vi.fn() } },
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
});
