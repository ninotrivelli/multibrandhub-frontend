import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { Signal, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  makeBrand,
  makeCategory,
  makeReportExportPreview,
  makeReportExportTemplates,
  makeUser,
  paged,
} from '../../../../testing/builders';
import { BrandsService } from '../../../core/brands/brands.service';
import { BrandResponse } from '../../../core/brands/brands.types';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProductCategoriesService } from '../../../core/product-categories/product-categories.service';
import { ProductCategoryResponse } from '../../../core/product-categories/product-categories.types';
import { ReportsService } from '../../../core/reports/reports.service';
import { ReportExportRequest } from '../../../core/reports/reports.types';
import { UsersService } from '../../../core/users/users.service';
import { UserResponse } from '../../../core/users/users.types';
import { AdminReportsComponent } from './reports.component';

describe('AdminReportsComponent', () => {
  let fixture: ComponentFixture<AdminReportsComponent>;
  let component: AdminReportsComponent;
  let brandItems: WritableSignal<BrandResponse[]>;
  let categoryItems: WritableSignal<ProductCategoryResponse[]>;
  let userItems: WritableSignal<UserResponse[]>;
  let reports: {
    getTemplates: ReturnType<typeof vi.fn>;
    preview: ReturnType<typeof vi.fn>;
    exportExcel: ReturnType<typeof vi.fn>;
  };
  let brands: {
    items: Signal<BrandResponse[]>;
    list: ReturnType<typeof vi.fn>;
  };
  let categories: {
    items: Signal<ProductCategoryResponse[]>;
    list: ReturnType<typeof vi.fn>;
  };
  let users: {
    items: Signal<UserResponse[]>;
    list: ReturnType<typeof vi.fn>;
  };
  let notifications: {
    success: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();

    brandItems = signal<BrandResponse[]>([
      makeBrand({ id: 'brand-own', name: 'Zendra' }),
      makeBrand({ id: 'brand-a', name: 'Lumina' }),
      makeBrand({ id: 'brand-archived', name: 'Nara', status: 'Archived' }),
    ]);
    categoryItems = signal<ProductCategoryResponse[]>([
      makeCategory({ id: 'cat-tops', name: 'Tops' }),
      makeCategory({ id: 'cat-pants', name: 'Pantalones' }),
    ]);
    userItems = signal<UserResponse[]>([
      makeUser({ id: 'user-admin', fullName: 'Admin Local', role: 'Admin' }),
      makeUser({ id: 'user-seller', fullName: 'Venta Mostrador', role: 'Seller' }),
      makeUser({
        id: 'user-brand-manager',
        fullName: 'Marca Responsable',
        role: 'BrandManager',
        brandId: 'brand-a',
        brandName: 'Lumina',
      }),
      makeUser({ id: 'user-inactive', fullName: 'Vendedora Inactiva', isActive: false }),
    ]);

    reports = {
      getTemplates: vi.fn(() => of(makeReportExportTemplates())),
      preview: vi.fn(() => of(makeReportExportPreview())),
      exportExcel: vi.fn(() =>
        of(
          new HttpResponse({
            body: new Blob(['xlsx']),
            headers: new HttpHeaders({
              'content-disposition': 'attachment; filename="reporte.xlsx"',
            }),
          }),
        ),
      ),
    };
    brands = {
      items: brandItems.asReadonly(),
      list: vi.fn(() => of(paged(brandItems()))),
    };
    categories = {
      items: categoryItems.asReadonly(),
      list: vi.fn(() => of(categoryItems())),
    };
    users = {
      items: userItems.asReadonly(),
      list: vi.fn(() => of(paged(userItems()))),
    };
    notifications = {
      success: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AdminReportsComponent],
      providers: [
        { provide: ReportsService, useValue: reports },
        { provide: BrandsService, useValue: brands },
        { provide: ProductCategoriesService, useValue: categories },
        { provide: UsersService, useValue: users },
        { provide: NotificationService, useValue: notifications },
      ],
    });

    TestBed.overrideComponent(AdminReportsComponent, { set: { template: '' } });
    await TestBed.compileComponents();
  });

  function create(): void {
    fixture = TestBed.createComponent(AdminReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('selects LocalMonthlyClose by default and loads historical filter sources', () => {
    create();

    expect(reports.getTemplates).toHaveBeenCalledOnce();
    expect(brands.list).toHaveBeenCalledWith({ page: 1, pageSize: 100, includeArchived: true });
    expect(categories.list).toHaveBeenCalledWith(true);
    expect(users.list).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
    expect((component as any).selectedReportType()).toBe('LocalMonthlyClose');
    expect((component as any).brandOptions().map((option: { label: string }) => option.label)).toContain(
      'Nara (archivada)',
    );
    expect((component as any).sellerOptions().map((option: { value: string }) => option.value)).toEqual([
      'user-admin',
      'user-seller',
    ]);
  });

  it('builds requests with only supported non-empty filters', () => {
    create();

    (component as any).setBrandIds(['brand-a']);
    (component as any).setCategoryIds(['cat-tops']);
    (component as any).setPaymentMethods(['Cash']);

    const request = (component as any).buildRequest() as ReportExportRequest;

    expect(request).toEqual({
      reportType: 'LocalMonthlyClose',
      from: expect.stringMatching(/^\d{4}-\d{2}-01$/),
      to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      brandIds: ['brand-a'],
      paymentMethods: ['Cash'],
    });
    expect(request.categoryIds).toBeUndefined();
  });

  it('cleans unsupported filters when the selected template changes', () => {
    create();

    (component as any).selectReport('SalesDetail');
    (component as any).setCategoryIds(['cat-tops']);
    (component as any).setSaleStatuses(['Canceled']);

    (component as any).selectReport('InventoryValuation');
    const request = (component as any).buildRequest() as ReportExportRequest;

    expect((component as any).selectedSaleStatuses()).toEqual([]);
    expect(request.categoryIds).toEqual(['cat-tops']);
    expect(request.saleStatuses).toBeUndefined();
  });

  it('treats current-state reports as date-disabled while keeping backend dates valid', () => {
    create();

    (component as any).selectReport('SalesDetail');
    (component as any).setFromDate('2026-06-30');
    (component as any).setToDate('2026-06-01');
    expect((component as any).dateRangeInvalid()).toBe(true);

    (component as any).selectReport('InventoryValuation');
    const request = (component as any).buildRequest() as ReportExportRequest;

    expect((component as any).dateFiltersApply()).toBe(false);
    expect((component as any).currentStateReport()).toBe(true);
    expect((component as any).dateRangeInvalid()).toBe(false);
    expect(request.reportType).toBe('InventoryValuation');
    expect(request.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(request.to).toBe(request.from);

    (component as any).selectReport('SalesDetail');
    const dateReportRequest = (component as any).buildRequest() as ReportExportRequest;

    expect((component as any).dateFiltersApply()).toBe(true);
    expect(dateReportRequest.from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(dateReportRequest.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('hides manual brand filtering for MyBrand and lets the backend scope it', () => {
    create();

    (component as any).selectReport('MyBrand');
    (component as any).setBrandIds(['brand-a']);

    const request = (component as any).buildRequest() as ReportExportRequest;

    expect((component as any).showBrandFilter()).toBe(false);
    expect(request.reportType).toBe('MyBrand');
    expect(request.brandIds).toBeUndefined();
    expect(request.immobilizedDays).toBe(60);
  });

  it('invokes Excel export and saves the returned blob', () => {
    create();
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    (component as any).downloadExcel();

    expect(reports.exportExcel).toHaveBeenCalledWith(
      expect.objectContaining({ reportType: 'LocalMonthlyClose' }),
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(notifications.success).toHaveBeenCalledWith('Excel descargado.');

    clickSpy.mockRestore();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: originalRevokeObjectUrl,
    });
  });
});
