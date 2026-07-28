import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { primeNgTestProviders } from '../../../../../testing/primeng-test-providers';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserRole } from '../../../../core/auth/auth.types';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { StoreProfileService } from '../../../../core/store-profile/store-profile.service';
import { StoreProfileResponse } from '../../../../core/store-profile/store-profile.types';
import { AdminAjustesGeneralesComponent } from './ajustes-generales.component';

describe('AdminAjustesGeneralesComponent', () => {
  let fixture: ComponentFixture<AdminAjustesGeneralesComponent>;
  let component: AdminAjustesGeneralesComponent;
  let role: WritableSignal<UserRole>;
  let profile: WritableSignal<StoreProfileResponse | null>;
  let service: { update: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });
    role = signal<UserRole>('Admin');
    profile = signal<StoreProfileResponse | null>({
      storeName: 'MultiBrandHub Centro',
      address: null,
      primaryPhone: null,
      secondaryPhone: null,
      contactEmail: null,
      updatedAt: null,
    });
    const saving = signal(false);
    service = {
      update: vi.fn((body: any) => {
        saving.set(true);
        const next = { ...body, updatedAt: '2026-05-01T00:00:00Z' };
        profile.set(next);
        saving.set(false);
        return of(next);
      }),
    };

    TestBed.configureTestingModule({
      imports: [AdminAjustesGeneralesComponent],
      providers: [
        { provide: AuthService, useValue: { role: role.asReadonly() } },
        {
          provide: StoreProfileService,
          useValue: {
            profile: profile.asReadonly(),
            hasData: signal(true).asReadonly(),
            saving: saving.asReadonly(),
            loading: signal(false).asReadonly(),
            update: service.update,
          },
        },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(AdminAjustesGeneralesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('gates editing to Admin/SuperAdmin', () => {
    expect((component as any).canEdit()).toBe(true);

    role.set('Seller');

    expect((component as any).canEdit()).toBe(false);
  });

  it('trims nullable fields before saving store profile', () => {
    (component as any).startEdit();
    (component as any).form.patchValue({
      storeName: ' MultiBrandHub Pocitos ',
      address: ' ',
      primaryPhone: ' 099 123 456 ',
      secondaryPhone: '',
      contactEmail: 'contacto@local.test',
    });

    (component as any).submit();

    expect(service.update).toHaveBeenCalledWith({
      storeName: 'MultiBrandHub Pocitos',
      address: null,
      primaryPhone: '099 123 456',
      secondaryPhone: null,
      contactEmail: 'contacto@local.test',
    });
    expect((component as any).editing()).toBe(false);
  });
});
