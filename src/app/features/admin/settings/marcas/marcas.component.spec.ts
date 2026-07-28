import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { makeAuthUser, makeBrand, makeUser } from '../../../../../testing/builders';
import { primeNgTestProviders } from '../../../../../testing/primeng-test-providers';
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
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });
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

  it('refreshes brands and users when the archived filter changes', () => {
    const brandsService = TestBed.inject(BrandsService) as any;
    const usersService = TestBed.inject(UsersService) as any;
    brandsService.list.mockClear();
    usersService.list.mockClear();

    (component as any).onShowArchivedChange(true);

    expect(brandsService.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      includeArchived: true,
    });
    expect(usersService.list).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
  });

  it('renders own, archived and unassigned brands with contract details', () => {
    currentUser.set(makeAuthUser({ role: 'SuperAdmin', brandId: 'own' }));
    brands.set([
      makeBrand({
        id: 'own',
        name: 'Marca Propia',
        logoUrl: 'https://example.test/logo.png',
        contractType: 'CommissionOnly',
        commissionPercentage: 12.5,
      }),
      makeBrand({
        id: 'fixed',
        name: 'Renta Fija',
        contactEmail: null,
        contractType: 'FixedRent',
        fixedRentCost: 4000,
      }),
      makeBrand({
        id: 'archived',
        name: 'Marca Archivada',
        contractType: 'Hybrid',
        status: 'Archived',
      }),
    ]);
    users.set([
      makeUser({
        id: 'admin-own',
        role: 'Admin',
        brandId: 'own',
        fullName: 'Dueña Local',
      }),
    ]);
    (component as any).showArchived.set(true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Tu Marca');
    expect(text).toContain('Dada de baja');
    expect(text).toContain('Marca sin usuario asociado');
    expect(text).toContain('Solo comisión');
    expect(text).toContain('Alquiler fijo');
    expect(text).toContain('Mixto');
    expect(text).toContain('Sin email');
    expect((component as any).canHardDelete()).toBe(true);
  });

  it('covers avatar, identity, association and agreement helpers', () => {
    const logoBrand = makeBrand({ id: 'logo', logoUrl: 'https://example.test/logo.png' });
    const noLogo = makeBrand({
      id: 'plain',
      name: '  casa   azul ',
      logoUrl: null,
      contractType: 'Hybrid',
      commissionPercentage: 10,
      fixedRentCost: 1500,
    });
    users.set([
      makeUser({ id: 'inactive', brandId: 'plain', role: 'BrandManager', isActive: false }),
      makeUser({ id: 'seller', brandId: 'plain', role: 'Seller' }),
      makeUser({ id: 'active', brandId: 'plain', role: 'BrandManager', fullName: 'Gestora' }),
    ]);

    expect((component as any).avatarImage(logoBrand)).toBe('https://example.test/logo.png');
    expect((component as any).avatarLabel(logoBrand)).toBeUndefined();
    expect((component as any).avatarImage(noLogo)).toBeUndefined();
    expect((component as any).avatarLabel(noLogo)).toBe('CA');
    expect((component as any).initialsOf('')).toBe('?');
    expect((component as any).isArchived(makeBrand({ status: 'Archived' }))).toBe(true);
    expect((component as any).primaryAssociatedUser(noLogo)?.fullName).toBe('Gestora');
    expect((component as any).primaryAssociatedUser(logoBrand)).toBeNull();
    expect((component as any).contractSeverity('CommissionOnly')).toBe('info');
    expect((component as any).contractSeverity('FixedRent')).toBe('warn');
    expect((component as any).contractSeverity('Hybrid')).toBe('success');
    expect((component as any).agreementText(noLogo)).toContain('comisión');
    expect((component as any).agreementText(noLogo)).toContain('alquiler');
  });

  it('opens and resets brand and user editing dialogs', () => {
    const brand = makeBrand({ id: 'edit' });

    (component as any).openCreateBrand();
    expect((component as any).brandDialogMode()).toBe('create');
    expect((component as any).brandDialogEditing()).toBeNull();

    (component as any).openEditBrand(brand);
    expect((component as any).brandDialogMode()).toBe('edit');
    expect((component as any).brandDialogEditing()).toEqual(brand);

    (component as any).openCreateBrandManager(brand);
    (component as any).onUserDialogVisibleChange(false);
    expect((component as any).userDialogDefaults()).toBeNull();

    (component as any).openCreateBrandManager(brand);
    (component as any).onUserDeleted();
    expect((component as any).userDialogVisible()).toBe(false);
    expect((component as any).userDialogDefaults()).toBeNull();
  });

  it('offboards a confirmed external brand and refreshes the list', () => {
    const brand = makeBrand({ id: 'external', name: 'Externa' });
    const brandsService = TestBed.inject(BrandsService) as any;
    const notifications = TestBed.inject(NotificationService) as any;
    brandsService.offboard.mockReturnValue(
      of({ brandName: 'Externa', productsArchived: 5, usersDeactivated: 2 }),
    );
    brandsService.list.mockClear();

    (component as any).openOffboardBrandDialog(brand);
    expect((component as any).canConfirmOffboardBrand()).toBe(false);
    (component as any).offboardBrandNameInput.set(' Externa ');
    (component as any).confirmOffboardBrand();

    expect(brandsService.offboard).toHaveBeenCalledWith('external');
    expect(notifications.success).toHaveBeenCalledWith(
      'Se dio de baja Externa. Productos archivados: 5. Usuarios desactivados: 2.',
    );
    expect((component as any).offboardBrandDialogVisible()).toBe(false);
    expect((component as any).offboardBrandTarget()).toBeNull();
    expect(brandsService.list).toHaveBeenCalled();
  });

  it('guards offboarding controls while pending and clears error state', () => {
    const brand = makeBrand({ id: 'external', name: 'Externa' });
    const brandsService = TestBed.inject(BrandsService) as any;
    brandsService.offboard.mockReturnValue(throwError(() => new Error('network')));

    (component as any).confirmOffboardBrand();
    expect(brandsService.offboard).not.toHaveBeenCalled();

    (component as any).openOffboardBrandDialog(brand);
    (component as any).offboardBrandNameInput.set('Externa');
    (component as any).confirmOffboardBrand();
    expect((component as any).offboardingBrand()).toBe(false);

    (component as any).offboardingBrand.set(true);
    (component as any).onOffboardBrandDialogVisibleChange(false);
    (component as any).cancelOffboardBrand();
    expect((component as any).offboardBrandDialogVisible()).toBe(true);

    (component as any).offboardingBrand.set(false);
    (component as any).cancelOffboardBrand();
    expect((component as any).offboardBrandTarget()).toBeNull();
  });

  it('hard-deletes a confirmed empty brand and resets the dialog', () => {
    const brand = makeBrand({ id: 'empty', name: 'Vacía' });
    const brandsService = TestBed.inject(BrandsService) as any;
    const notifications = TestBed.inject(NotificationService) as any;
    brandsService.delete.mockReturnValue(of(undefined));

    (component as any).openDeleteBrandDialog(brand);
    expect((component as any).canConfirmDeleteBrand()).toBe(false);
    (component as any).deleteBrandNameInput.set(' Vacía ');
    (component as any).confirmDeleteBrand();

    expect(brandsService.delete).toHaveBeenCalledWith('empty');
    expect(notifications.success).toHaveBeenCalledWith('Se eliminó Vacía.');
    expect((component as any).deleteBrandDialogVisible()).toBe(false);
    expect((component as any).deleteBrandTarget()).toBeNull();
  });

  it('guards delete controls while pending and recovers from backend errors', () => {
    const brand = makeBrand({ id: 'empty', name: 'Vacía' });
    const brandsService = TestBed.inject(BrandsService) as any;
    brandsService.delete.mockReturnValue(throwError(() => new Error('network')));

    (component as any).openDeleteBrandDialog(brand);
    (component as any).deleteBrandNameInput.set('Vacía');
    (component as any).confirmDeleteBrand();
    expect((component as any).deletingBrand()).toBe(false);

    (component as any).deletingBrand.set(true);
    (component as any).onDeleteBrandDialogVisibleChange(false);
    (component as any).cancelDeleteBrand();
    expect((component as any).deleteBrandDialogVisible()).toBe(true);

    (component as any).deletingBrand.set(false);
    (component as any).cancelDeleteBrand();
    expect((component as any).deleteBrandTarget()).toBeNull();
  });
});
