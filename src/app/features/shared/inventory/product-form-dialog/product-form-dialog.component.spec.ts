import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeAuthUser, makeBrand, makeCategory, makeProduct } from '../../../../../testing/builders';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthUser, UserRole } from '../../../../core/auth/auth.types';
import { BrandsService } from '../../../../core/brands/brands.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ProductCategoriesService } from '../product-categories.service';
import { ProductsService } from '../products.service';
import { ProductFormDialogComponent } from './product-form-dialog.component';

describe('ProductFormDialogComponent', () => {
  let fixture: ComponentFixture<ProductFormDialogComponent>;
  let component: ProductFormDialogComponent;
  let role: WritableSignal<UserRole>;
  let user: WritableSignal<AuthUser | null>;
  let products: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    reactivate: ReturnType<typeof vi.fn>;
    validateSku: ReturnType<typeof vi.fn>;
  };
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    role = signal<UserRole>('Admin');
    user = signal<AuthUser | null>(makeAuthUser({ role: 'Admin', brandId: 'brand-own' }));
    products = {
      create: vi.fn((body: any) => of(makeProduct({ ...body, id: 'created-product' }))),
      update: vi.fn((id: string, body: any) => of(makeProduct({ ...body, id }))),
      reactivate: vi.fn((id: string) => of(makeProduct({ id, isActive: true }))),
      validateSku: vi.fn((sku: string) =>
        of({
          sku,
          isUnique: sku.endsWith('-002'),
          exists: !sku.endsWith('-002'),
          isActive: true,
          isArchived: false,
          archivedAtUtc: null,
        }),
      ),
    };
    notifications = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ProductFormDialogComponent],
      providers: [
        { provide: AuthService, useValue: { role: role.asReadonly(), user: user.asReadonly() } },
        { provide: ProductsService, useValue: products },
        {
          provide: BrandsService,
          useValue: { items: signal([makeBrand()]).asReadonly() },
        },
        {
          provide: ProductCategoriesService,
          useValue: { items: signal([makeCategory()]).asReadonly() },
        },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    TestBed.overrideComponent(ProductFormDialogComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(ProductFormDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('mode', 'create');
    fixture.detectChanges();
  });

  it('creates products without overriding the backend default critical-stock threshold', () => {
    const saved = vi.fn();
    const visibleChange = vi.fn();
    component.saved.subscribe(saved);
    component.visibleChange.subscribe(visibleChange);

    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('mode', 'create');
    fixture.detectChanges();

    (component as any).form.patchValue({
      sku: 'ZEND-BUZ-001',
      name: ' Buzo Oversize ',
      brandId: 'brand-own',
      categoryId: 'cat-tops',
      size: ' M ',
      color: ' Negro ',
      price: 1850,
      currentStock: 5,
    });

    (component as any).submit();

    expect(products.create).toHaveBeenCalledWith({
      sku: 'ZEND-BUZ-001',
      name: 'Buzo Oversize',
      description: null,
      imageUrl: null,
      price: 1850,
      color: 'Negro',
      size: 'M',
      currentStock: 5,
      minStockAlert: null,
      brandId: 'brand-own',
      categoryId: 'cat-tops',
    });
    expect(saved).toHaveBeenCalled();
    expect(visibleChange).toHaveBeenCalledWith(false);
  });

  it('edits product metadata and threshold while keeping stock, brand, and SKU locked', () => {
    const editing = makeProduct({ id: 'product-edit', minStockAlert: 2, currentStock: 7 });
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('editing', editing);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const form = (component as any).form;
    expect(form.controls.sku.disabled).toBe(true);
    expect(form.controls.brandId.disabled).toBe(true);
    expect(form.controls.currentStock.disabled).toBe(true);
    expect(form.controls.minStockAlert.enabled).toBe(true);

    form.patchValue({
      name: ' Buzo Editado ',
      categoryId: 'cat-tops',
      size: 'L',
      color: 'Azul',
      price: 1990,
      minStockAlert: 4,
    });

    (component as any).submit();

    expect(products.update).toHaveBeenCalledWith(editing.id, {
      name: 'Buzo Editado',
      description: null,
      imageUrl: editing.imageUrl,
      price: 1990,
      color: 'Azul',
      size: 'L',
      minStockAlert: 4,
      categoryId: 'cat-tops',
    });
  });

  it('defensively locks BrandManager create scope to their own brand if rendered', () => {
    role.set('BrandManager');
    user.set(makeAuthUser({ role: 'BrandManager', brandId: 'brand-owned-by-manager' }));

    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const brandCtrl = (component as any).form.controls.brandId;
    expect(brandCtrl.disabled).toBe(true);
    expect(brandCtrl.getRawValue()).toBe('brand-owned-by-manager');
  });

  it('generates the first unique SKU returned by backend validation', async () => {
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    (component as any).form.patchValue({
      name: 'Buzo Oversize',
      brandId: 'brand-own',
      categoryId: 'cat-tops',
      size: 'M',
      color: 'Negro',
    });

    await (component as any).generateSku();

    expect(products.validateSku).toHaveBeenCalledTimes(2);
    expect((component as any).form.controls.sku.value).toBe('ZEND-BUZOVE-M-NEGRO-002');
  });
});
