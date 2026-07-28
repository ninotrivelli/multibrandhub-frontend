import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeAuthUser, makeBrand, makeUser } from '../../../../../../testing/builders';
import { primeNgTestProviders } from '../../../../../../testing/primeng-test-providers';
import { AuthService } from '../../../../../core/auth/auth.service';
import { AuthUser } from '../../../../../core/auth/auth.types';
import { BrandsService } from '../../../../../core/brands/brands.service';
import { NotificationService } from '../../../../../core/notifications/notification.service';
import { UsersService } from '../../../../../core/users/users.service';
import { UserFormDialogComponent } from './user-form-dialog.component';

describe('UserFormDialogComponent', () => {
  let fixture: ComponentFixture<UserFormDialogComponent>;
  let component: UserFormDialogComponent;
  let currentUser: WritableSignal<AuthUser | null>;
  let users: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });
    currentUser = signal<AuthUser | null>(makeAuthUser({ role: 'Admin' }));
    users = {
      create: vi.fn((body: any) => of(makeUser({ ...body, id: 'created-user' }))),
      update: vi.fn((id: string, body: any) => of(makeUser({ ...body, id }))),
      delete: vi.fn(() => of(undefined)),
    };

    TestBed.configureTestingModule({
      imports: [UserFormDialogComponent],
      providers: [
        { provide: AuthService, useValue: { user: currentUser.asReadonly() } },
        { provide: UsersService, useValue: users },
        {
          provide: BrandsService,
          useValue: {
            items: signal([makeBrand({ id: 'brand-a', name: 'Lumina', code: 'LUM' })]).asReadonly(),
            hasItems: signal(true).asReadonly(),
            loading: signal(false).asReadonly(),
            list: vi.fn(() => of({ items: [], totalCount: 0, page: 1, pageSize: 100 })),
          },
        },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(UserFormDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('editing', null);
    fixture.componentRef.setInput('defaults', null);
    fixture.detectChanges();
  });

  it('lets Admin create Sellers and BrandManagers, requiring a brand for BrandManagers', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    expect((component as any).roleOptions().map((option: any) => option.value)).toEqual([
      'BrandManager',
      'Seller',
    ]);

    const form = (component as any).form;
    form.patchValue({
      fullName: 'Marca Nueva',
      email: 'marca@test.com',
      password: '12345678',
      confirmPassword: '12345678',
      role: 'BrandManager',
      brandId: null,
    });
    (component as any).submit();
    expect(users.create).not.toHaveBeenCalled();
    expect(form.controls.brandId.hasError('required')).toBe(true);

    form.patchValue({ brandId: 'brand-a' });
    (component as any).submit();
    expect(users.create).toHaveBeenCalledWith({
      fullName: 'Marca Nueva',
      email: 'marca@test.com',
      password: '12345678',
      role: 'BrandManager',
      brandId: 'brand-a',
    });
  });

  it('clears brand association when creating a Seller', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const form = (component as any).form;
    form.patchValue({
      fullName: 'Vendedora Local',
      email: 'seller@test.com',
      password: '12345678',
      confirmPassword: '12345678',
      role: 'Seller',
      brandId: 'brand-a',
    });

    (component as any).submit();

    expect(users.create).toHaveBeenCalledWith({
      fullName: 'Vendedora Local',
      email: 'seller@test.com',
      password: '12345678',
      role: 'Seller',
      brandId: null,
    });
    expect(form.controls.brandId.disabled).toBe(true);
  });

  it('protects self-edit role, brand, and active fields', () => {
    const self = makeUser({
      id: 'user-admin',
      fullName: 'Admin Local',
      email: 'admin@local.test',
      role: 'Admin',
      brandId: 'brand-own',
      isActive: true,
    });

    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('editing', self);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const form = (component as any).form;
    expect(form.controls.role.disabled).toBe(true);
    expect(form.controls.brandId.disabled).toBe(true);
    expect(form.controls.isActive.disabled).toBe(true);
  });

  it('requires matching email confirmation before deleting', () => {
    const target = makeUser({ id: 'user-delete', email: 'seller@test.com' });
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('editing', target);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    (component as any).requestDelete();
    (component as any).deleteEmailInput.set('wrong@test.com');
    (component as any).confirmDelete();
    expect(users.delete).not.toHaveBeenCalled();

    (component as any).deleteEmailInput.set('seller@test.com');
    (component as any).confirmDelete();
    expect(users.delete).toHaveBeenCalledWith('user-delete');
  });
});
