import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { MfaStatusResponse } from '../../../../core/auth/auth.types';
import { MfaService } from '../../../../core/auth/mfa.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { AdminSeguridadComponent } from './seguridad.component';

describe('AdminSeguridadComponent', () => {
  let fixture: ComponentFixture<AdminSeguridadComponent>;
  let status: ReturnType<typeof signal<MfaStatusResponse | null>>;

  beforeEach(async () => {
    status = signal<MfaStatusResponse | null>(null);
    const mfa = {
      status: status.asReadonly(),
      loadingStatus: signal(false).asReadonly(),
      loadStatus: vi.fn(() => of(status())),
    };

    await TestBed.configureTestingModule({
      imports: [AdminSeguridadComponent],
      providers: [
        provideRouter([]),
        { provide: MfaService, useValue: mfa },
        { provide: AuthService, useValue: { clearSession: vi.fn(), logout: vi.fn() } },
        {
          provide: NotificationService,
          useValue: { success: vi.fn(), error: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminSeguridadComponent);
  });

  it('distinguishes unavailable, available, active, and active-with-enrollment-paused states', () => {
    status.set({
      enrollmentAvailable: false,
      enabled: false,
      enabledAtUtc: null,
      recoveryCodesRemaining: 0,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no está habilitada actualmente');
    expect(fixture.nativeElement.querySelector('button[aria-label="Activar MFA"]')).toBeNull();

    status.set({
      enrollmentAvailable: true,
      enabled: false,
      enabledAtUtc: null,
      recoveryCodesRemaining: 0,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Activar MFA');

    status.set({
      enrollmentAvailable: true,
      enabled: true,
      enabledAtUtc: '2026-07-20T18:00:00Z',
      recoveryCodesRemaining: 10,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Códigos de recuperación disponibles');
    expect(fixture.nativeElement.textContent).toContain('Regenerar códigos');

    status.set({ ...status()!, enrollmentAvailable: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('tu MFA sigue activo');
    expect(fixture.nativeElement.textContent).toContain('Desactivar MFA');
  });
});
