import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeAuthUser, makeBrand, makeUser } from '../../../../../testing/builders';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthUser } from '../../../../core/auth/auth.types';
import { BrandsService } from '../../../../core/brands/brands.service';
import { BrandResponse } from '../../../../core/brands/brands.types';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { UsersService } from '../../../../core/users/users.service';
import { UserResponse } from '../../../../core/users/users.types';
import { AdminMarcasComponent } from './marcas.component';

describe('AdminMarcasComponent', () => {
  let fixture: ComponentFixture<AdminMarcasComponent>;
  let component: AdminMarcasComponent;
  let currentUser: WritableSignal<AuthUser | null>;
  let brands: WritableSignal<BrandResponse[]>;
  let users: WritableSignal<UserResponse[]>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    currentUser = signal<AuthUser | null>(makeAuthUser({ role: 'Admin', brandId: 'brand-own' }));
    brands = signal<BrandResponse[]>([]);
    users = signal<UserResponse[]>([]);

    TestBed.configureTestingModule({
      imports: [AdminMarcasComponent],
      providers: [
        { provide: AuthService, useValue: { user: currentUser.asReadonly() } },
        {
          provide: BrandsService,
          useValue: {
            items: brands.asReadonly(),
            loading: signal(false).asReadonly(),
            hasItems: signal(true).asReadonly(),
            list: vi.fn(() => of({ items: [], totalCount: 0, page: 1, pageSize: 100 })),
            offboard: vi.fn(),
            delete: vi.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            items: users.asReadonly(),
            loading: signal(false).asReadonly(),
            list: vi.fn(() => of({ items: [], totalCount: 0, page: 1, pageSize: 100 })),
          },
        },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(AdminMarcasComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(AdminMarcasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('orders own brand first, hides archived brands by default, and detects missing users', () => {
    const own = makeBrand({ id: 'brand-own', name: 'Kora' });
    const external = makeBrand({ id: 'brand-b', name: 'Bohemia' });
    const archived = makeBrand({ id: 'brand-z', name: 'Zendra', status: 'Archived' });
    brands.set([external, archived, own]);
    users.set([makeUser({ id: 'manager-b', role: 'BrandManager', brandId: 'brand-b' })]);

    expect((component as any).orderedBrands().map((brand: BrandResponse) => brand.id)).toEqual([
      'brand-own',
      'brand-b',
    ]);
    expect((component as any).hasAssociatedUser(external)).toBe(true);
    expect((component as any).hasAssociatedUser(own)).toBe(false);

    (component as any).showArchived.set(true);
    expect((component as any).orderedBrands().map((brand: BrandResponse) => brand.id)).toEqual([
      'brand-own',
      'brand-b',
      'brand-z',
    ]);
  });

  it('opens BrandManager creation with the selected brand defaults', () => {
    const brand = makeBrand({ id: 'brand-b' });

    (component as any).openCreateBrandManager(brand);

    expect((component as any).userDialogVisible()).toBe(true);
    expect((component as any).userDialogDefaults()).toEqual({
      role: 'BrandManager',
      brandId: 'brand-b',
    });
  });
});
