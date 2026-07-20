import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { makeAuthUser } from '../../../../testing/builders';
import { AuthService } from '../../../core/auth/auth.service';
import { CashRegisterService } from '../../../core/cash-register/cash-register.service';
import { StoreProfileService } from '../../../core/store-profile/store-profile.service';
import { AppShell } from './app-shell';

describe('AppShell cash register status', () => {
  let fixture: ComponentFixture<AppShell>;
  const currentAgeText = signal<string | null>('hace 10 días');
  const hasStaleOpenRegister = signal(true);

  beforeEach(async () => {
    TestBed.resetTestingModule();
    currentAgeText.set('hace 10 días');
    hasStaleOpenRegister.set(true);

    TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: signal(makeAuthUser({ role: 'Admin' })).asReadonly(),
            role: signal('Admin').asReadonly(),
            logout: vi.fn(),
          },
        },
        {
          provide: StoreProfileService,
          useValue: {
            storeName: signal('MultiBrand Hub').asReadonly(),
            load: vi.fn(() => of(null)),
          },
        },
        {
          provide: CashRegisterService,
          useValue: {
            currentLoaded: signal(true).asReadonly(),
            hasOpenRegister: signal(true).asReadonly(),
            currentAgeText: currentAgeText.asReadonly(),
            hasStaleOpenRegister: hasStaleOpenRegister.asReadonly(),
            loadCurrent: vi.fn(() => of(null)),
          },
        },
      ],
    });
    TestBed.overrideComponent(AppShell, {
      set: {
        template: `
          <span>{{ cashOpen() ? 'Caja abierta ' + cashAgeText() : 'Caja cerrada' }}</span>
        `,
      },
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
  });

  it('shows the exact old-register age in the global header', () => {
    expect(fixture.nativeElement.textContent).toContain('Caja abierta hace 10 días');
  });

  it('returns to the normal today label when the register is current', () => {
    currentAgeText.set('hoy');
    hasStaleOpenRegister.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Caja abierta hoy');
  });
});
