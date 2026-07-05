import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import {
  makeAuthUser,
  makeBrand,
  makeCategory,
  makeProduct,
} from '../../../../../testing/builders';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthUser, UserRole } from '../../../../core/auth/auth.types';
import { BrandsService } from '../../../../core/brands/brands.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ProductCategoriesService } from '../../../../core/product-categories/product-categories.service';
import { ProductCategoryResponse } from '../../../../core/product-categories/product-categories.types';
import { categoryPlaceholderUrl } from '../inventory.utils';
import { ProductsService } from '../products.service';
import { ProductFormDialogComponent } from './product-form-dialog.component';

describe('ProductFormDialogComponent', () => {
  let fixture: ComponentFixture<ProductFormDialogComponent>;
  let component: ProductFormDialogComponent;
  let role: WritableSignal<UserRole>;
  let user: WritableSignal<AuthUser | null>;
  let categoryItems: WritableSignal<ProductCategoryResponse[]>;
  let products: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    uploadImage: ReturnType<typeof vi.fn>;
    clearImage: ReturnType<typeof vi.fn>;
    reactivate: ReturnType<typeof vi.fn>;
    validateSku: ReturnType<typeof vi.fn>;
  };
  let notifications: {
    success: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let originalCreateObjectUrl: typeof URL.createObjectURL;
  let originalRevokeObjectUrl: typeof URL.revokeObjectURL;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    role = signal<UserRole>('Admin');
    user = signal<AuthUser | null>(makeAuthUser({ role: 'Admin', brandId: 'brand-own' }));
    categoryItems = signal<ProductCategoryResponse[]>([
      makeCategory({ id: 'cat-tops', name: 'Tops' }),
      makeCategory({ id: 'cat-rings', name: 'Anillos' }),
    ]);
    products = {
      create: vi.fn((body: any) => of(makeProduct({ ...body, id: 'created-product' }))),
      update: vi.fn((id: string, body: any) => of(makeProduct({ ...body, id }))),
      uploadImage: vi.fn((id: string) =>
        of(makeProduct({ id, imageUrl: 'https://cdn.test/producto.webp' })),
      ),
      clearImage: vi.fn((id: string) => of(makeProduct({ id, imageUrl: null }))),
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
    notifications = { success: vi.fn(), warn: vi.fn(), error: vi.fn() };
    originalCreateObjectUrl = URL.createObjectURL;
    originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:product-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    TestBed.configureTestingModule({
      imports: [ProductFormDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AuthService, useValue: { role: role.asReadonly(), user: user.asReadonly() } },
        { provide: ProductsService, useValue: products },
        {
          provide: BrandsService,
          useValue: { items: signal([makeBrand()]).asReadonly() },
        },
        {
          provide: ProductCategoriesService,
          useValue: { items: categoryItems.asReadonly() },
        },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(ProductFormDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('mode', 'create');
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: originalRevokeObjectUrl,
    });
  });

  it('creates products without overriding the backend default critical-stock threshold', async () => {
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

    await (component as any).submit();

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
    expect(products.uploadImage).not.toHaveBeenCalled();
    expect(saved).toHaveBeenCalled();
    expect(visibleChange).toHaveBeenCalledWith(false);
  });

  it('creates products with a selected image after the product exists', async () => {
    const file = new File(['image'], 'anillo.png', { type: 'image/png' });
    const saved = vi.fn();
    component.saved.subscribe(saved);

    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('mode', 'create');
    fixture.detectChanges();
    fillCreateForm();

    (component as any).onImageInputChange({
      target: { files: [file], value: '' },
    } as unknown as Event);

    await (component as any).submit();

    expect(products.create).toHaveBeenCalledOnce();
    expect(products.uploadImage).toHaveBeenCalledWith('created-product', file);
    expect(saved).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'created-product',
        imageUrl: 'https://cdn.test/producto.webp',
      }),
    );
  });

  it('shows the selected category fallback when there is no custom image', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('mode', 'create');
    fixture.detectChanges();

    (component as any).form.patchValue({ categoryId: 'cat-rings' });
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector(
      '[data-testid="product-image-preview"]',
    ) as HTMLImageElement;
    expect(preview.getAttribute('src')).toBe(categoryPlaceholderUrl('Anillos'));
  });

  it('edits product metadata and threshold while keeping stock, brand, and SKU locked', async () => {
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

    await (component as any).submit();

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
    expect(products.uploadImage).not.toHaveBeenCalled();
  });

  it('uploads a new image after editing product metadata', async () => {
    const file = new File(['image'], 'nuevo.webp', { type: 'image/webp' });
    const editing = makeProduct({
      id: 'product-edit',
      imageUrl: 'https://cdn.test/old.webp',
    });
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('editing', editing);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    (component as any).form.patchValue({ name: 'Buzo con foto nueva' });
    (component as any).onImageInputChange({
      target: { files: [file], value: '' },
    } as unknown as Event);

    await (component as any).submit();

    expect(products.update).toHaveBeenCalledOnce();
    expect(products.uploadImage).toHaveBeenCalledWith(editing.id, file);
    expect(products.clearImage).not.toHaveBeenCalled();
  });

  it('clears an existing image after editing when requested', async () => {
    const editing = makeProduct({
      id: 'product-edit',
      imageUrl: 'https://cdn.test/old.webp',
    });
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('editing', editing);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    (component as any).removeImage({ value: 'C:\\fakepath\\old.webp' } as HTMLInputElement);

    await (component as any).submit();

    expect(products.update).toHaveBeenCalledOnce();
    expect(products.clearImage).toHaveBeenCalledWith(editing.id);
    expect(products.uploadImage).not.toHaveBeenCalled();
  });

  it('rejects invalid image files before any backend call', () => {
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    (component as any).onImageInputChange({
      target: { files: [new File(['bad'], 'foto.gif', { type: 'image/gif' })], value: '' },
    } as unknown as Event);

    expect(notifications.error).toHaveBeenCalledWith('Formato no permitido. Usá JPG, PNG o WebP.');
    expect((component as any).selectedImageFile()).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(products.create).not.toHaveBeenCalled();
    expect(products.update).not.toHaveBeenCalled();
    expect(products.uploadImage).not.toHaveBeenCalled();
    expect(products.clearImage).not.toHaveBeenCalled();
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

  function fillCreateForm(): void {
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
  }
});
