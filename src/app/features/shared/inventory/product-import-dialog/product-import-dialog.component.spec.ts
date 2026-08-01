import { HttpErrorResponse } from '@angular/common/http';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FileUpload } from 'primeng/fileupload';
import { of, throwError } from 'rxjs';

import { makeAuthUser, makeBrand } from '../../../../../testing/builders';
import { primeNgTestProviders } from '../../../../../testing/primeng-test-providers';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthUser, UserRole } from '../../../../core/auth/auth.types';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ProductsService } from '../products.service';
import { ProductImportDialogComponent } from './product-import-dialog.component';

describe('ProductImportDialogComponent', () => {
  let fixture: ComponentFixture<ProductImportDialogComponent>;
  let component: ProductImportDialogComponent;
  let role: WritableSignal<UserRole>;
  let user: WritableSignal<AuthUser | null>;
  let products: {
    importProducts: ReturnType<typeof vi.fn>;
    downloadImportTemplate: ReturnType<typeof vi.fn>;
  };
  let notifications: { error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });
    role = signal<UserRole>('Admin');
    user = signal<AuthUser | null>(makeAuthUser({ role: 'Admin', brandId: 'brand-own' }));
    products = {
      importProducts: vi.fn(() => of({ totalRows: 1, created: 1, rejected: 0, errors: [] })),
      downloadImportTemplate: vi.fn(() => of(new Blob(['template']))),
    };
    notifications = { error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ProductImportDialogComponent],
      providers: [
        { provide: AuthService, useValue: { role: role.asReadonly(), user: user.asReadonly() } },
        { provide: ProductsService, useValue: products },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(ProductImportDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('brands', [makeBrand()]);
    fixture.detectChanges();
  });

  it('validates file extension and size before selecting a file', () => {
    const fileInput = { clear: vi.fn() };

    (component as any).onFileSelect(
      { files: [new File(['bad'], 'productos.txt', { type: 'text/plain' })] },
      fileInput,
    );

    expect(notifications.error).toHaveBeenCalledWith(
      'Formato no permitido. Usá .csv, .xls o .xlsx.',
    );
    expect(fileInput.clear).toHaveBeenCalled();
    expect((component as any).selectedFile()).toBeNull();

    (component as any).onFileSelect(
      { files: [new File(['ok'], 'productos.csv', { type: 'text/csv' })] },
      fileInput,
    );
    expect((component as any).selectedFile()?.name).toBe('productos.csv');
  });

  it('clears the PrimeNG file selection when the dialog is reopened', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const fileUpload = fixture.debugElement.query(By.directive(FileUpload))
      .componentInstance as FileUpload;
    const file = new File(['SKU,Nombre'], 'productos-anteriores.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    fileUpload.onFileSelect({ type: 'change', target: { files: [file] } } as any);
    fixture.detectChanges();

    expect(fileUpload.files).toEqual([file]);
    expect(fixture.nativeElement.textContent).toContain('productos-anteriores.xlsx');

    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    expect(fileUpload.files).toEqual([]);
    expect((component as any).selectedFile()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('productos-anteriores.xlsx');
  });

  it('locks BrandManager imports to their own brand defensively if rendered', () => {
    role.set('BrandManager');
    user.set(makeAuthUser({ role: 'BrandManager', brandId: 'brand-manager' }));

    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    expect((component as any).brandLocked()).toBe(true);
    expect((component as any).selectedBrandId()).toBe('brand-manager');
  });

  it('shows backend row-level import errors without closing the dialog', () => {
    const file = new File(['SKU,Nombre'], 'productos.csv', { type: 'text/csv' });
    products.importProducts.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              totalRows: 1,
              created: 0,
              rejected: 1,
              errors: [
                {
                  row: 2,
                  field: 'SKU',
                  value: 'DUP',
                  message: 'SKU duplicado',
                },
              ],
            },
          }),
      ),
    );

    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    (component as any).selectedBrandId.set('brand-own');
    (component as any).selectedFile.set(file);

    (component as any).submit();

    expect(products.importProducts).toHaveBeenCalledWith('brand-own', file);
    expect((component as any).rowErrors()).toEqual([
      { row: 2, field: 'SKU', value: 'DUP', message: 'SKU duplicado' },
    ]);
    expect((component as any).submitError()).toBeNull();
  });
});
