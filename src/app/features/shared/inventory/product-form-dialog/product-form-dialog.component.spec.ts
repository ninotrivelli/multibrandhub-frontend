import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

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

  it('exposes active selector options and image-action presentation states', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput(
      'editing',
      makeProduct({ imageUrl: ' https://cdn.test/existing.webp ' }),
    );
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    expect((component as any).brandOptions()).toEqual([{ label: 'Zendra', value: 'brand-own' }]);
    expect((component as any).categoryOptions()).toHaveLength(2);
    expect((component as any).selectedCategoryName()).toBe('Tops');
    expect((component as any).hasExistingCustomImage()).toBe(true);
    expect((component as any).imagePreviewUrl()).toBe('https://cdn.test/existing.webp');
    expect((component as any).imageActionLabel()).toBe('Cambiar foto');
    expect((component as any).canRemoveImage()).toBe(true);

    (component as any).clearExistingImage.set(true);
    expect((component as any).hasExistingCustomImage()).toBe(false);
    expect((component as any).imageActionLabel()).toBe('Subir foto');
  });

  it('normalizes SKU input and surfaces touched validation state', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    (component as any).normalizeSkuInput('sku-bajo');
    expect((component as any).form.controls.sku.value).toBe('SKU-BAJO');
    expect((component as any).isInvalid('name')).toBe(false);

    (component as any).form.controls.name.markAsTouched();
    expect((component as any).isInvalid('name')).toBe(true);
  });

  it('rejects oversized images and safely ignores empty file inputs', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    (component as any).onImageInputChange({
      target: { files: [], value: '' },
    } as unknown as Event);
    expect(notifications.error).not.toHaveBeenCalled();

    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', {
      type: 'image/png',
    });
    const input = { files: [oversized], value: 'large.png' };
    (component as any).onImageInputChange({ target: input } as unknown as Event);

    expect(notifications.error).toHaveBeenCalledWith('La foto supera los 5 MB.');
    expect(input.value).toBe('');
    expect((component as any).selectedImageFile()).toBeNull();
  });

  it('guards close and submit actions while busy and marks invalid forms', async () => {
    const visibleChange = vi.fn();
    component.visibleChange.subscribe(visibleChange);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    (component as any).submitting.set(true);
    (component as any).onVisibleChange(false);
    (component as any).cancel();
    await (component as any).submit();
    expect(visibleChange).not.toHaveBeenCalled();

    (component as any).submitting.set(false);
    await (component as any).submit();
    expect((component as any).form.controls.name.touched).toBe(true);

    (component as any).cancel();
    expect(visibleChange).toHaveBeenCalledWith(false);
  });

  it('reports missing brand and backend SKU-validation failures', async () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    (component as any).form.patchValue({
      name: 'Producto',
      brandId: 'missing-brand',
      categoryId: 'cat-tops',
    });

    await (component as any).generateSku();
    expect(notifications.error).toHaveBeenCalledWith(
      'No encontramos la marca seleccionada. Probá de nuevo.',
    );

    (component as any).form.patchValue({ brandId: 'brand-own' });
    products.validateSku.mockReturnValueOnce(throwError(() => new Error('network')));
    await (component as any).generateSku();
    expect(notifications.error).toHaveBeenCalledWith(
      'No se pudo validar el SKU. Probá de nuevo o ingresalo a mano.',
    );
    expect((component as any).skuGenerating()).toBe(false);
  });

  it.each([
    {
      error: new HttpErrorResponse({
        status: 400,
        error: { errors: [{ message: 'SKU duplicado' }, { message: 'Nombre inválido' }] },
      }),
      expected: 'SKU duplicado • Nombre inválido',
    },
    {
      error: new HttpErrorResponse({ status: 400, error: { message: 'Error de producto' } }),
      expected: 'Error de producto',
    },
    {
      error: new HttpErrorResponse({ status: 500, error: null }),
      expected: 'No se pudo guardar. Probá de nuevo.',
    },
  ])('maps product save errors to actionable form copy', async ({ error, expected }) => {
    products.create.mockReturnValueOnce(throwError(() => error));
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    fillCreateForm();

    await (component as any).submit();

    expect((component as any).submitting()).toBe(false);
    expect((component as any).submitError()).toBe(expected);
  });

  it('keeps the saved product when image upload fails and warns the user', async () => {
    products.uploadImage.mockReturnValueOnce(throwError(() => new Error('storage')));
    const saved = vi.fn();
    component.saved.subscribe(saved);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    fillCreateForm();
    (component as any).onImageInputChange({
      target: {
        files: [new File(['image'], 'valid.png', { type: 'image/png' })],
        value: 'valid.png',
      },
    } as unknown as Event);

    await (component as any).submit();

    expect(notifications.warn).toHaveBeenCalledWith(
      'El artículo se guardó, pero no pudimos actualizar la foto. Probá de nuevo desde editar.',
    );
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ id: 'created-product' }));
    expect((component as any).uploadingImage()).toBe(false);
  });

  it('reactivates archived products for operational roles and handles errors', () => {
    const archived = makeProduct({ id: 'archived', name: 'Archivado', isActive: false });
    const saved = vi.fn();
    const visibleChange = vi.fn();
    component.saved.subscribe(saved);
    component.visibleChange.subscribe(visibleChange);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('editing', archived);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    expect((component as any).canReactivateEditing()).toBe(true);
    (component as any).reactivateEditing();
    expect(products.reactivate).toHaveBeenCalledWith('archived');
    expect(notifications.success).toHaveBeenCalled();
    expect(saved).toHaveBeenCalled();
    expect(visibleChange).toHaveBeenCalledWith(false);

    products.reactivate.mockReturnValueOnce(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { message: 'No se puede reactivar' } }),
      ),
    );
    (component as any).reactivateEditing();
    expect((component as any).reactivating()).toBe(false);
    expect((component as any).submitError()).toBe('No se puede reactivar');
  });

  it('does not reactivate active products or archived products for BrandManager', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('editing', makeProduct({ isActive: true }));
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    (component as any).reactivateEditing();
    expect(products.reactivate).not.toHaveBeenCalled();

    role.set('BrandManager');
    fixture.componentRef.setInput('editing', makeProduct({ isActive: false }));
    fixture.detectChanges();
    expect((component as any).canReactivateEditing()).toBe(false);
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
