import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeAuthUser, makeBrand } from '../../../../testing/builders';
import { primeNgTestProviders } from '../../../../testing/primeng-test-providers';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthUser } from '../../../core/auth/auth.types';
import { BrandsService } from '../../../core/brands/brands.service';
import { ConfiguracionComponent } from './configuracion.component';

describe('ConfiguracionComponent', () => {
  let fixture: ComponentFixture<ConfiguracionComponent>;
  let component: ConfiguracionComponent;
  let user: WritableSignal<AuthUser | null>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });
    user = signal<AuthUser | null>(
      makeAuthUser({
        userId: 'manager-1',
        fullName: 'Marca Responsable',
        role: 'BrandManager',
        brandId: 'brand-a',
      }),
    );

    TestBed.configureTestingModule({
      imports: [ConfiguracionComponent],
      providers: [
        { provide: AuthService, useValue: { user: user.asReadonly() } },
        {
          provide: BrandsService,
          useValue: {
            items: signal([makeBrand({ id: 'brand-a', name: 'Lumina' })]).asReadonly(),
            hasItems: signal(true).asReadonly(),
            loading: signal(false).asReadonly(),
            list: vi.fn(() => of({ items: [], totalCount: 0, page: 1, pageSize: 100 })),
          },
        },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(ConfiguracionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders self-service profile context and opens password reset for the current user', () => {
    expect((component as any).initials()).toBe('MR');
    expect((component as any).associatedBrandName()).toBe('Lumina');
    expect((component as any).roleLabel('BrandManager')).toBe('Marca');

    (component as any).openResetPassword();

    expect((component as any).resetDialogVisible()).toBe(true);
    expect((component as any).resetTarget()).toEqual({
      id: 'manager-1',
      fullName: 'Marca Responsable',
      isSelf: true,
    });
  });
});
