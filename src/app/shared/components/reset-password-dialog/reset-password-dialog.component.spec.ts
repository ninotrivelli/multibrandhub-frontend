import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { NotificationService } from '../../../core/notifications/notification.service';
import { UsersService } from '../../../core/users/users.service';
import { ResetPasswordDialogComponent } from './reset-password-dialog.component';

describe('ResetPasswordDialogComponent', () => {
  let fixture: ComponentFixture<ResetPasswordDialogComponent>;
  let component: ResetPasswordDialogComponent;
  let users: { resetPassword: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    users = { resetPassword: vi.fn(() => of(undefined)) };

    TestBed.configureTestingModule({
      imports: [ResetPasswordDialogComponent],
      providers: [
        { provide: UsersService, useValue: users },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(ResetPasswordDialogComponent, { set: { template: '' } });
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
    expect((component as any).form.controls.confirmPassword.hasError('mismatch')).toBe(true);
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
  });
});
