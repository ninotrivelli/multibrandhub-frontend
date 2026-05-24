import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeAuthUser } from '../../../../testing/builders';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthUser, UserRole } from '../../../core/auth/auth.types';
import { BrandsService } from '../../../core/brands/brands.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProductCategoriesService } from './product-categories.service';
import { ProductsService } from './products.service';
import { InventoryShellComponent } from './inventory-shell.component';

describe('InventoryShellComponent', () => {
  let fixture: ComponentFixture<InventoryShellComponent>;
  let component: InventoryShellComponent;
  let role: WritableSignal<UserRole>;
  let user: WritableSignal<AuthUser | null>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    role = signal<UserRole>('Admin');
    user = signal<AuthUser | null>(makeAuthUser({ role: 'Admin', brandId: 'brand-own' }));

    TestBed.configureTestingModule({
      imports: [InventoryShellComponent],
      providers: [
        { provide: AuthService, useValue: { role: role.asReadonly(), user: user.asReadonly() } },
        {
          provide: ProductsService,
          useValue: {
            loadKpiCounts: vi.fn(() => of({ total: 0, critical: 0, outOfStock: 0 })),
            loadAll: vi.fn(() => of([])),
            loadImmobilizedCount: vi.fn(() => of(0)),
            archive: vi.fn(),
          },
        },
        {
          provide: BrandsService,
          useValue: { list: vi.fn(() => of({ items: [], totalCount: 0, page: 1, pageSize: 100 })) },
        },
        { provide: ProductCategoriesService, useValue: { list: vi.fn(() => of([])) } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(InventoryShellComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(InventoryShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('grants Admin and Seller the full inventory action surface', () => {
    expect((component as any).canCreateProduct()).toBe(true);
    expect((component as any).canEditProduct()).toBe(true);
    expect((component as any).canArchiveProduct()).toBe(true);
    expect((component as any).canRegisterMovement()).toBe(true);
    expect((component as any).canImportProducts()).toBe(true);

    role.set('Seller');
    user.set(makeAuthUser({ role: 'Seller', brandId: null }));

    expect((component as any).canCreateProduct()).toBe(true);
    expect((component as any).canEditProduct()).toBe(true);
    expect((component as any).canArchiveProduct()).toBe(true);
    expect((component as any).canRegisterMovement()).toBe(true);
    expect((component as any).canImportProducts()).toBe(true);
  });

  it('limits BrandManager to scoped metadata editing without stock-changing actions', () => {
    role.set('BrandManager');
    user.set(makeAuthUser({ role: 'BrandManager', brandId: 'brand-manager' }));

    expect((component as any).brandScope()).toBe('brand-manager');
    expect((component as any).canCreateProduct()).toBe(false);
    expect((component as any).canEditProduct()).toBe(true);
    expect((component as any).canArchiveProduct()).toBe(false);
    expect((component as any).canRegisterMovement()).toBe(false);
    expect((component as any).canImportProducts()).toBe(false);
    expect((component as any).canSeeArchived()).toBe(false);
  });
});
