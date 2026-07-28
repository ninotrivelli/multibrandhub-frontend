import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { Signal, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import {
  makeBrand,
  makeCategory,
  makeReportExportPreview,
  makeReportExportTemplates,
  makeUser,
  paged,
} from '../../../../testing/builders';
import { primeNgTestProviders } from '../../../../testing/primeng-test-providers';
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
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });

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

  it('groups catalog templates and places backend extensions under Otros', () => {
    reports.getTemplates.mockReturnValue(
      of(
        makeReportExportTemplates({
          templates: [
            ...makeReportExportTemplates().templates,
            {
              reportType: 'CashRegister',
              name: 'Caja',
              description: 'Cierres de caja',
              supportedFilters: ['From', 'To'],
              columns: [],
            },
            {
              reportType: 'UnexpectedReport' as any,
              name: 'Personalizado',
              description: 'Publicado por backend',
              supportedFilters: [],
              columns: [],
            },
          ],
        }),
      ),
    );
    create();

    const groups = (component as any).groupedTemplates();
    expect(groups.find((group: any) => group.label === 'Cierres y conciliación').items).toHaveLength(
      2,
    );
    expect(groups.find((group: any) => group.label === 'Otros').items[0].name).toBe(
      'Personalizado',
    );
  });

  it('reports catalog and filter-source loading failures', () => {
    reports.getTemplates.mockReturnValue(throwError(() => new Error('catalog')));
    brands.list.mockReturnValue(throwError(() => new Error('filters')));

    create();

    expect((component as any).loadingCatalog()).toBe(false);
    expect((component as any).loadingFilters()).toBe(false);
    expect((component as any).error()).toBe('No se pudieron cargar algunos filtros.');
  });

  it('does not reload the catalog while another request is active', () => {
    create();
    reports.getTemplates.mockClear();
    (component as any).loadingCatalog.set(true);

    (component as any).loadCatalog();

    expect(reports.getTemplates).not.toHaveBeenCalled();
  });

  it('builds every optional filter supported by a backend template', () => {
    create();
    (component as any).templates.set([
      {
        reportType: 'StockMovements',
        name: 'Movimientos',
        description: 'Todos los filtros',
        supportedFilters: [
          'From',
          'To',
          'BrandIds',
          'CategoryIds',
          'SellerIds',
          'PaymentMethods',
          'SaleStatuses',
          'MovementTypes',
          'StockStatuses',
          'ImmobilizedDays',
          'IncludeInactiveProducts',
        ],
        columns: [],
      },
    ]);
    (component as any).selectedReportType.set('StockMovements');
    (component as any).setBrandIds(['brand-a']);
    (component as any).setCategoryIds(['cat-tops']);
    (component as any).setSellerIds(['user-seller']);
    (component as any).setPaymentMethods(['DebitCard']);
    (component as any).setSaleStatuses(['Completed']);
    (component as any).setMovementTypes(['Loss']);
    (component as any).setStockStatuses(['Critical']);
    (component as any).setImmobilizedDays('90');
    (component as any).setIncludeInactiveProducts(true);

    expect((component as any).buildRequest()).toEqual(
      expect.objectContaining({
        reportType: 'StockMovements',
        brandIds: ['brand-a'],
        categoryIds: ['cat-tops'],
        sellerIds: ['user-seller'],
        paymentMethods: ['DebitCard'],
        saleStatuses: ['Completed'],
        movementTypes: ['Loss'],
        stockStatuses: ['Critical'],
        immobilizedDays: 90,
        includeInactiveProducts: true,
      }),
    );
  });

  it('normalizes null setter values and resets every filter', () => {
    create();
    (component as any).selectReport('SalesDetail');
    (component as any).setBrandIds(null);
    (component as any).setCategoryIds(null);
    (component as any).setSellerIds(null);
    (component as any).setPaymentMethods(null);
    (component as any).setSaleStatuses(null);
    (component as any).setMovementTypes(null);
    (component as any).setStockStatuses(null);
    (component as any).setImmobilizedDays('invalid');
    (component as any).setIncludeInactiveProducts(true);

    expect((component as any).immobilizedDays()).toBeNull();
    expect((component as any).preview()).toBeNull();

    (component as any).resetFilters();

    expect((component as any).selectedBrandIds()).toEqual([]);
    expect((component as any).selectedCategoryIds()).toEqual([]);
    expect((component as any).selectedSellerIds()).toEqual([]);
    expect((component as any).selectedPaymentMethods()).toEqual([]);
    expect((component as any).selectedSaleStatuses()).toEqual([]);
    expect((component as any).selectedMovementTypes()).toEqual([]);
    expect((component as any).selectedStockStatuses()).toEqual([]);
    expect((component as any).includeInactiveProducts()).toBe(false);
  });

  it('validates immobilized-day limits only for reports that support them', () => {
    create();
    (component as any).selectReport('MyBrand');

    for (const invalid of [null, 0, 3651, 1.5]) {
      (component as any).immobilizedDays.set(invalid);
      expect((component as any).immobilizedDaysInvalid()).toBe(true);
      expect((component as any).canBuildRequest()).toBe(false);
    }

    (component as any).immobilizedDays.set(3650);
    expect((component as any).immobilizedDaysInvalid()).toBe(false);

    (component as any).selectReport('SalesDetail');
    (component as any).immobilizedDays.set(null);
    expect((component as any).immobilizedDaysInvalid()).toBe(false);
  });

  it('generates a preview and exposes rows, columns and formatted summary entries', () => {
    const preview = makeReportExportPreview({
      summary: { Total: 3200, Disponible: true, Nota: 'Cierre' },
    });
    reports.preview.mockReturnValue(of(preview));
    create();

    (component as any).generatePreview();

    expect(reports.preview).toHaveBeenCalledWith(
      expect.objectContaining({ reportType: 'LocalMonthlyClose' }),
    );
    expect((component as any).preview()).toEqual(preview);
    expect((component as any).previewRows()).toEqual(preview.rows);
    expect((component as any).previewColumns()).toEqual(preview.columns);
    expect((component as any).summaryEntries()).toEqual([
      { label: 'Total', value: '3.200' },
      { label: 'Disponible', value: 'Sí' },
      { label: 'Nota', value: 'Cierre' },
    ]);
    expect((component as any).previewLoading()).toBe(false);
  });

  it('reports preview failures and guards invalid or busy preview requests', () => {
    reports.preview.mockReturnValue(throwError(() => new Error('preview')));
    create();

    (component as any).generatePreview();
    expect((component as any).error()).toBe('No se pudo generar la vista previa.');
    expect((component as any).preview()).toBeNull();

    reports.preview.mockClear();
    (component as any).selectedReportType.set(null);
    (component as any).generatePreview();
    expect(reports.preview).not.toHaveBeenCalled();
  });

  it('reports empty and failed Excel responses without saving a file', () => {
    reports.exportExcel.mockReturnValueOnce(of(new HttpResponse<Blob>({ body: null })));
    create();

    (component as any).downloadExcel();
    expect((component as any).error()).toBe('El archivo vino vacío.');
    expect((component as any).exporting()).toBe(false);

    reports.exportExcel.mockReturnValueOnce(throwError(() => new Error('export')));
    (component as any).downloadExcel();
    expect((component as any).error()).toBe('No se pudo descargar el Excel.');
    expect((component as any).exporting()).toBe(false);
  });

  it('formats cells, widths, row identities and human-readable date ranges', () => {
    create();
    const money = { key: 'amount', header: 'Importe', dataType: 'money' } as const;

    expect((component as any).formatCell({ amount: 1500 }, money)).toContain('1.500');
    expect((component as any).columnWidth({ ...money, key: 'productName' })).toBe('16rem');
    expect((component as any).columnWidth({ ...money, key: 'ticketId' })).toBe('12rem');
    expect(
      (component as any).columnWidth({ key: 'date', header: 'Fecha', dataType: 'datetime' }),
    ).toBe('12rem');
    expect((component as any).columnWidth(money)).toBe('11rem');
    expect(
      (component as any).columnWidth({ key: 'qty', header: 'Cantidad', dataType: 'number' }),
    ).toBe('9rem');
    expect(
      (component as any).columnWidth({ key: 'name', header: 'Nombre', dataType: 'string' }),
    ).toBe('10rem');
    expect((component as any).rowTrack({ id: 'row-id' }, 4)).toBe('row-id');
    expect((component as any).rowTrack({ ticketId: 'ticket-id' }, 4)).toBe('ticket-id');
    expect((component as any).rowTrack({ sku: 'sku-id' }, 4)).toBe('sku-id');
    expect((component as any).rowTrack({}, 4)).toBe('4');
    expect((component as any).rangeLabel()).toMatch(/\d{2}\/\d{2}\/\d{4} al /);
  });

  it('keeps selection stable and falls back to the first or no template', () => {
    create();
    reports.getTemplates.mockClear();
    (component as any).selectReport('LocalMonthlyClose');
    expect((component as any).selectedReportType()).toBe('LocalMonthlyClose');

    (component as any).templates.set([
      {
        reportType: 'SalesDetail',
        name: 'Ventas',
        description: 'Detalle',
        supportedFilters: ['From', 'To'],
        columns: [],
      },
    ]);
    (component as any).selectedReportType.set('LocalMonthlyClose');
    (component as any).loadCatalog();
    expect(reports.getTemplates).toHaveBeenCalled();

    (component as any).templates.set([]);
    (component as any).selectedReportType.set(null);
    expect((component as any).selectedTemplate()).toBeNull();
    expect((component as any).buildRequest()).toBeNull();
  });
});
