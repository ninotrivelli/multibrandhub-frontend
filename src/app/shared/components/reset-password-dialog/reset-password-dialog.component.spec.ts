import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { primeNgTestProviders } from '../../../../testing/primeng-test-providers';
import { NotificationService } from '../../../core/notifications/notification.service';
import { AuthService } from '../../../core/auth/auth.service';
import { UsersService } from '../../../core/users/users.service';
import { ResetPasswordDialogComponent } from './reset-password-dialog.component';

describe('ResetPasswordDialogComponent', () => {
  let fixture: ComponentFixture<ResetPasswordDialogComponent>;
  let component: ResetPasswordDialogComponent;
  let users: { resetPassword: ReturnType<typeof vi.fn> };
  let auth: { logout: ReturnType<typeof vi.fn> };
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });
    users = { resetPassword: vi.fn(() => of(undefined)) };
    auth = { logout: vi.fn() };
    notifications = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ResetPasswordDialogComponent],
      providers: [
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(ResetPasswordDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('target', null);
    fixture.detectChanges();
  });

  it('requires matching passwords before reset', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('target', { id: 'user-1', fullName: 'Usuario' });
    fixture.detectChanges();

    (component as any).form.patchValue({
      newPassword: '12345678',
      confirmPassword: '87654321',
    });
    (component as any).submit();

    expect(users.resetPassword).not.toHaveBeenCalled();
    expect((component as any).form.hasError('passwordMismatch')).toBe(true);
  });

  it('resets the target password and closes on success', () => {
    const success = vi.fn();
    const visibleChange = vi.fn();
    component.success.subscribe(success);
    component.visibleChange.subscribe(visibleChange);

    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('target', { id: 'user-1', fullName: 'Usuario' });
    fixture.detectChanges();

    (component as any).form.patchValue({
      newPassword: '12345678',
      confirmPassword: '12345678',
    });
    (component as any).submit();

    expect(users.resetPassword).toHaveBeenCalledWith('user-1', '12345678');
    expect(success).toHaveBeenCalled();
    expect(visibleChange).toHaveBeenCalledWith(false);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(notifications.success).toHaveBeenCalledWith('Contraseña actualizada.');
  });

  it('logs out only after successfully changing the current user password', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('target', {
      id: 'user-self',
      fullName: 'Usuario actual',
      isSelf: true,
    });
    fixture.detectChanges();

    (component as any).form.patchValue({
      newPassword: 'Nueva1234',
      confirmPassword: 'Nueva1234',
    });
    (component as any).submit();

    expect(auth.logout).toHaveBeenCalledOnce();
    expect(notifications.success).toHaveBeenCalledWith(
      'Contraseña actualizada. Volvé a iniciar sesión.',
    );
  });
});
