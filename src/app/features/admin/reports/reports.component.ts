import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  LucideIconData,
  LucideAngularModule,
  Package,
  Receipt,
  RefreshCw,
  SlidersHorizontal,
  Store,
  Table2,
} from 'lucide-angular';

import { BrandsService } from '../../../core/brands/brands.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProductCategoriesService } from '../../../core/product-categories/product-categories.service';
import { ReportsService } from '../../../core/reports/reports.service';
import {
  ReportExportColumnResponse,
  ReportExportFilterKey,
  ReportExportPreviewResponse,
  ReportExportRequest,
  ReportExportTemplateResponse,
  ReportExportType,
  ReportMovementType,
  ReportPaymentMethod,
  ReportSaleStatus,
  ReportStockStatus,
} from '../../../core/reports/reports.types';
import {
  currentUruguayMonthRange,
  fallbackReportFileName,
  formatReportCell,
  formatSummaryValue,
  normalizeDateRange,
  resolveReportFileName,
} from '../../../core/reports/reports.utils';
import { UsersService } from '../../../core/users/users.service';
import { UserResponse } from '../../../core/users/users.types';

interface FilterOption<T extends string> {
  label: string;
  value: T;
}

interface SummaryEntry {
  label: string;
  value: string;
}

interface ReportTemplateGroup {
  label: string;
  description: string;
  icon: LucideIconData;
  types: ReportExportType[];
}

const REPORT_GROUPS: ReportTemplateGroup[] = [
  {
    label: 'Cierres y conciliación',
    description: 'Cierre mensual, caja y liquidaciones.',
    icon: Receipt,
    types: ['LocalMonthlyClose', 'CashRegister', 'BrandSettlements'],
  },
  {
    label: 'Ventas y rendimiento',
    description: 'Detalle comercial, rankings y vendedoras.',
    icon: BarChart3,
    types: ['SalesDetail', 'BrandPerformance', 'TopProducts', 'StaffPerformance'],
  },
  {
    label: 'Inventario',
    description: 'Stock valorizado, alertas y movimientos.',
    icon: Package,
    types: ['InventoryValuation', 'ImmobilizedStock', 'StockAlerts', 'StockMovements'],
  },
  {
    label: 'Marca propia',
    description: 'Pack enfocado en Mi Marca.',
    icon: Store,
    types: ['MyBrand'],
  },
];

const PAYMENT_METHOD_OPTIONS: FilterOption<ReportPaymentMethod>[] = [
  { label: 'Efectivo', value: 'Cash' },
  { label: 'Crédito', value: 'CreditCard' },
  { label: 'Débito', value: 'DebitCard' },
  { label: 'Transferencia', value: 'Transfer' },
  { label: 'Mercado Pago', value: 'MercadoPago' },
];

const SALE_STATUS_OPTIONS: FilterOption<ReportSaleStatus>[] = [
  { label: 'Completadas', value: 'Completed' },
  { label: 'Anuladas', value: 'Canceled' },
  { label: 'Pendientes', value: 'Pending' },
  { label: 'Reintegradas', value: 'Refunded' },
];

const MOVEMENT_TYPE_OPTIONS: FilterOption<ReportMovementType>[] = [
  { label: 'Ingreso', value: 'StockIn' },
  { label: 'Venta', value: 'Sale' },
  { label: 'Devolución', value: 'Return' },
  { label: 'Ajuste', value: 'Adjustment' },
  { label: 'Egreso', value: 'Loss' },
  { label: 'Cambio de precio', value: 'PriceChange' },
];

const STOCK_STATUS_OPTIONS: FilterOption<ReportStockStatus>[] = [
  { label: 'OK', value: 'InStock' },
  { label: 'Crítico', value: 'Critical' },
  { label: 'Agotado', value: 'OutOfStock' },
];

@Component({
  selector: 'app-admin-reports',
  imports: [
    FormsModule,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    MultiSelectModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
    TooltipModule,
    LucideAngularModule,
    DatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.component.html',
})
export class AdminReportsComponent implements OnInit {
  private readonly reports = inject(ReportsService);
  private readonly brands = inject(BrandsService);
  private readonly categories = inject(ProductCategoriesService);
  private readonly users = inject(UsersService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly icons = {
    AlertCircle,
    CalendarDays,
    Download,
    Eye,
    FileSpreadsheet,
    Filter,
    RefreshCw,
    SlidersHorizontal,
    Table2,
  };

  protected readonly paymentMethodOptions = PAYMENT_METHOD_OPTIONS;
  protected readonly saleStatusOptions = SALE_STATUS_OPTIONS;
  protected readonly movementTypeOptions = MOVEMENT_TYPE_OPTIONS;
  protected readonly stockStatusOptions = STOCK_STATUS_OPTIONS;

  protected readonly loadingCatalog = signal(false);
  protected readonly loadingFilters = signal(false);
  protected readonly previewLoading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly templates = signal<ReportExportTemplateResponse[]>([]);
  protected readonly defaultImmobilizedDays = signal(60);
  protected readonly previewRowLimit = signal(100);
  protected readonly maxRows = signal(100000);
  protected readonly selectedReportType = signal<ReportExportType | null>(null);
  protected readonly preview = signal<ReportExportPreviewResponse | null>(null);

  protected readonly fromDate = signal(currentUruguayMonthRange().from);
  protected readonly toDate = signal(currentUruguayMonthRange().to);
  protected readonly selectedBrandIds = signal<string[]>([]);
  protected readonly selectedCategoryIds = signal<string[]>([]);
  protected readonly selectedSellerIds = signal<string[]>([]);
  protected readonly selectedPaymentMethods = signal<ReportPaymentMethod[]>([]);
  protected readonly selectedSaleStatuses = signal<ReportSaleStatus[]>([]);
  protected readonly selectedMovementTypes = signal<ReportMovementType[]>([]);
  protected readonly selectedStockStatuses = signal<ReportStockStatus[]>([]);
  protected readonly immobilizedDays = signal<number | null>(60);
  protected readonly includeInactiveProducts = signal(false);

  protected readonly selectedTemplate = computed(() => {
    const selected = this.selectedReportType();
    return this.templates().find((template) => template.reportType === selected) ?? null;
  });

  protected readonly supportedFilters = computed(
    () => new Set<ReportExportFilterKey>(this.selectedTemplate()?.supportedFilters ?? []),
  );

  protected readonly groupedTemplates = computed(() => {
    const templates = this.templates();
    const used = new Set<ReportExportType>();
    const groups = REPORT_GROUPS.map((group) => {
      const items = group.types
        .map((type) => templates.find((template) => template.reportType === type))
        .filter((template): template is ReportExportTemplateResponse => !!template);
      for (const item of items) used.add(item.reportType);
      return { ...group, items };
    }).filter((group) => group.items.length > 0);

    const otherItems = templates.filter((template) => !used.has(template.reportType));
    if (otherItems.length > 0) {
      groups.push({
        label: 'Otros',
        description: 'Reportes publicados por backend.',
        icon: FileSpreadsheet,
        types: otherItems.map((template) => template.reportType),
        items: otherItems,
      });
    }

    return groups;
  });

  protected readonly brandOptions = computed(() =>
    this.brands
      .items()
      .map((brand) => ({
        label: brand.status === 'Archived' ? `${brand.name} (archivada)` : brand.name,
        value: brand.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es-UY', { sensitivity: 'base' })),
  );

  protected readonly categoryOptions = computed(() =>
    this.categories
      .items()
      .map((category) => ({ label: category.name, value: category.id }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es-UY', { sensitivity: 'base' })),
  );

  protected readonly sellerOptions = computed(() =>
    this.users
      .items()
      .filter((user) => user.isActive && user.role !== 'BrandManager')
      .map((user) => ({ label: `${user.fullName} · ${roleLabel(user)}`, value: user.id }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es-UY', { sensitivity: 'base' })),
  );

  protected readonly showBrandFilter = computed(
    () => this.supports('BrandIds') && this.selectedReportType() !== 'MyBrand',
  );

  protected readonly dateFiltersApply = computed(
    () => this.supports('From') || this.supports('To'),
  );

  protected readonly currentStateReport = computed(
    () => !!this.selectedTemplate() && !this.dateFiltersApply(),
  );

  protected readonly dateRangeInvalid = computed(() => {
    if (!this.dateFiltersApply()) return false;
    const from = this.fromDate();
    const to = this.toDate();
    return !from || !to || from > to;
  });

  protected readonly immobilizedDaysInvalid = computed(() => {
    if (!this.supports('ImmobilizedDays')) return false;
    const days = this.immobilizedDays();
    return !Number.isInteger(days) || days === null || days < 1 || days > 3650;
  });

  protected readonly canBuildRequest = computed(
    () => !!this.selectedTemplate() && !this.dateRangeInvalid() && !this.immobilizedDaysInvalid(),
  );

  protected readonly canRunPreview = computed(
    () => this.canBuildRequest() && !this.loadingCatalog() && !this.previewLoading(),
  );

  protected readonly canExport = computed(
    () => this.canBuildRequest() && !this.loadingCatalog() && !this.exporting(),
  );

  protected readonly previewColumns = computed(
    () => this.preview()?.columns ?? this.selectedTemplate()?.columns ?? [],
  );

  protected readonly previewRows = computed(() => this.preview()?.rows ?? []);

  protected readonly summaryEntries = computed<SummaryEntry[]>(() =>
    Object.entries(this.preview()?.summary ?? {}).map(([label, value]) => ({
      label,
      value: formatSummaryValue(value),
    })),
  );

  protected readonly rangeLabel = computed(() => {
    const range = normalizeDateRange(this.fromDate(), this.toDate());
    return `${formatDateOnlyLabel(range.from)} al ${formatDateOnlyLabel(range.to)}`;
  });

  ngOnInit(): void {
    this.loadCatalog();
    this.loadFilterSources();
  }

  protected loadCatalog(): void {
    if (this.loadingCatalog()) return;
    this.loadingCatalog.set(true);
    this.error.set(null);

    this.reports
      .getTemplates()
      .pipe(
        finalize(() => this.loadingCatalog.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (catalog) => {
          this.templates.set(catalog.templates);
          this.defaultImmobilizedDays.set(catalog.defaultImmobilizedDays);
          this.previewRowLimit.set(catalog.previewRowLimit);
          this.maxRows.set(catalog.maxRows);
          if (this.immobilizedDays() === null) {
            this.immobilizedDays.set(catalog.defaultImmobilizedDays);
          }
          this.ensureSelectedTemplate();
          this.cleanupUnsupportedFilters();
        },
        error: () => {
          this.error.set('No se pudo cargar el catálogo de reportes.');
        },
      });
  }

  protected selectReport(reportType: ReportExportType): void {
    if (this.selectedReportType() === reportType) return;
    const wasCurrentStateReport = this.currentStateReport();
    this.selectedReportType.set(reportType);
    if (wasCurrentStateReport && this.dateFiltersApply()) {
      this.resetDateRangeForDateReport();
    }
    this.preview.set(null);
    this.cleanupUnsupportedFilters();
  }

  protected setFromDate(value: string): void {
    this.fromDate.set(value);
    this.preview.set(null);
  }

  protected setToDate(value: string): void {
    this.toDate.set(value);
    this.preview.set(null);
  }

  protected setBrandIds(values: string[] | null): void {
    this.selectedBrandIds.set(values ?? []);
    this.preview.set(null);
  }

  protected setCategoryIds(values: string[] | null): void {
    this.selectedCategoryIds.set(values ?? []);
    this.preview.set(null);
  }

  protected setSellerIds(values: string[] | null): void {
    this.selectedSellerIds.set(values ?? []);
    this.preview.set(null);
  }

  protected setPaymentMethods(values: ReportPaymentMethod[] | null): void {
    this.selectedPaymentMethods.set(values ?? []);
    this.preview.set(null);
  }

  protected setSaleStatuses(values: ReportSaleStatus[] | null): void {
    this.selectedSaleStatuses.set(values ?? []);
    this.preview.set(null);
  }

  protected setMovementTypes(values: ReportMovementType[] | null): void {
    this.selectedMovementTypes.set(values ?? []);
    this.preview.set(null);
  }

  protected setStockStatuses(values: ReportStockStatus[] | null): void {
    this.selectedStockStatuses.set(values ?? []);
    this.preview.set(null);
  }

  protected setImmobilizedDays(value: number | string | null): void {
    const parsed = typeof value === 'number' ? value : Number(value);
    this.immobilizedDays.set(Number.isFinite(parsed) ? parsed : null);
    this.preview.set(null);
  }

  protected setIncludeInactiveProducts(value: boolean): void {
    this.includeInactiveProducts.set(value);
    this.preview.set(null);
  }

  protected resetFilters(): void {
    const range = currentUruguayMonthRange();
    this.fromDate.set(range.from);
    this.toDate.set(range.to);
    this.selectedBrandIds.set([]);
    this.selectedCategoryIds.set([]);
    this.selectedSellerIds.set([]);
    this.selectedPaymentMethods.set([]);
    this.selectedSaleStatuses.set([]);
    this.selectedMovementTypes.set([]);
    this.selectedStockStatuses.set([]);
    this.immobilizedDays.set(this.defaultImmobilizedDays());
    this.includeInactiveProducts.set(false);
    this.preview.set(null);
    this.cleanupUnsupportedFilters();
  }

  protected generatePreview(): void {
    const request = this.buildRequest();
    if (!request || !this.canRunPreview()) return;

    this.previewLoading.set(true);
    this.error.set(null);
    this.reports
      .preview(request)
      .pipe(
        finalize(() => this.previewLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.preview.set(response),
        error: () => {
          this.preview.set(null);
          this.error.set('No se pudo generar la vista previa.');
        },
      });
  }

  protected downloadExcel(): void {
    const request = this.buildRequest();
    if (!request || !this.canExport()) return;

    this.exporting.set(true);
    this.error.set(null);
    this.reports
      .exportExcel(request)
      .pipe(
        finalize(() => this.exporting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (!response.body) {
            this.error.set('El archivo vino vacío.');
            return;
          }
          const fallback = fallbackReportFileName(request.reportType, request.from, request.to);
          this.saveBlob(response.body, resolveReportFileName(response, fallback));
          this.notifications.success('Excel descargado.');
        },
        error: () => {
          this.error.set('No se pudo descargar el Excel.');
        },
      });
  }

  protected buildRequest(): ReportExportRequest | null {
    const template = this.selectedTemplate();
    if (!template) return null;
    const range = this.requestDateRange();

    const request: ReportExportRequest = {
      reportType: template.reportType,
      from: range.from,
      to: range.to,
    };

    if (this.supports('BrandIds') && template.reportType !== 'MyBrand') {
      addList(request, 'brandIds', this.selectedBrandIds());
    }
    if (this.supports('CategoryIds')) addList(request, 'categoryIds', this.selectedCategoryIds());
    if (this.supports('SellerIds')) addList(request, 'sellerIds', this.selectedSellerIds());
    if (this.supports('PaymentMethods')) {
      addList(request, 'paymentMethods', this.selectedPaymentMethods());
    }
    if (this.supports('SaleStatuses')) addList(request, 'saleStatuses', this.selectedSaleStatuses());
    if (this.supports('MovementTypes')) {
      addList(request, 'movementTypes', this.selectedMovementTypes());
    }
    if (this.supports('StockStatuses')) {
      addList(request, 'stockStatuses', this.selectedStockStatuses());
    }
    if (this.supports('ImmobilizedDays') && this.immobilizedDays() !== null) {
      request.immobilizedDays = this.immobilizedDays()!;
    }
    if (this.supports('IncludeInactiveProducts') && this.includeInactiveProducts()) {
      request.includeInactiveProducts = true;
    }

    return request;
  }

  protected supports(filter: ReportExportFilterKey): boolean {
    return this.supportedFilters().has(filter);
  }

  protected isSelected(reportType: ReportExportType): boolean {
    return this.selectedReportType() === reportType;
  }

  protected formatCell(
    row: Record<string, unknown>,
    column: ReportExportColumnResponse,
  ): string {
    return formatReportCell(row[column.key], column);
  }

  protected columnWidth(column: ReportExportColumnResponse): string {
    if (column.key === 'productName' || column.key === 'observations') return '16rem';
    if (column.key === 'ticketId' || column.key === 'sessionId') return '12rem';
    if (column.dataType === 'datetime') return '12rem';
    if (column.dataType === 'money') return '11rem';
    if (column.dataType === 'number') return '9rem';
    return '10rem';
  }

  protected rowTrack(row: Record<string, unknown>, index: number): string {
    return String(row['id'] ?? row['ticketId'] ?? row['sku'] ?? index);
  }

  private loadFilterSources(): void {
    this.loadingFilters.set(true);
    forkJoin({
      brands: this.brands.list({ page: 1, pageSize: 100, includeArchived: true }),
      categories: this.categories.list(true),
      users: this.users.list({ page: 1, pageSize: 100 }),
    })
      .pipe(
        finalize(() => this.loadingFilters.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => {
          this.error.set('No se pudieron cargar algunos filtros.');
        },
      });
  }

  private ensureSelectedTemplate(): void {
    const selected = this.selectedReportType();
    if (selected && this.templates().some((template) => template.reportType === selected)) return;
    const fallback =
      this.templates().find((template) => template.reportType === 'LocalMonthlyClose') ??
      this.templates()[0] ??
      null;
    this.selectedReportType.set(fallback?.reportType ?? null);
  }

  private cleanupUnsupportedFilters(): void {
    if (!this.dateFiltersApply()) {
      this.resetDateRangeForCurrentStateReport();
    }
    if (!this.supports('BrandIds') || this.selectedReportType() === 'MyBrand') {
      this.selectedBrandIds.set([]);
    }
    if (!this.supports('CategoryIds')) this.selectedCategoryIds.set([]);
    if (!this.supports('SellerIds')) this.selectedSellerIds.set([]);
    if (!this.supports('PaymentMethods')) this.selectedPaymentMethods.set([]);
    if (!this.supports('SaleStatuses')) this.selectedSaleStatuses.set([]);
    if (!this.supports('MovementTypes')) this.selectedMovementTypes.set([]);
    if (!this.supports('StockStatuses')) this.selectedStockStatuses.set([]);
    if (!this.supports('IncludeInactiveProducts')) this.includeInactiveProducts.set(false);
    if (this.supports('ImmobilizedDays') && this.immobilizedDays() === null) {
      this.immobilizedDays.set(this.defaultImmobilizedDays());
    }
  }

  private saveBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private requestDateRange(): { from: string; to: string } {
    const from = this.fromDate();
    const to = this.toDate();
    if (from && to && from <= to) return { from, to };
    return this.currentStateReport() ? currentUruguayTodayRange() : currentUruguayMonthRange();
  }

  private resetDateRangeForCurrentStateReport(): void {
    const range = currentUruguayTodayRange();
    this.fromDate.set(range.from);
    this.toDate.set(range.to);
  }

  private resetDateRangeForDateReport(): void {
    const range = currentUruguayMonthRange();
    this.fromDate.set(range.from);
    this.toDate.set(range.to);
  }
}

function addList<K extends keyof ReportExportRequest>(
  request: ReportExportRequest,
  key: K,
  values: ReportExportRequest[K],
): void {
  if (Array.isArray(values) && values.length > 0) {
    request[key] = values;
  }
}

function roleLabel(user: UserResponse): string {
  if (user.role === 'SuperAdmin') return 'Super Admin';
  if (user.role === 'Admin') return 'Admin';
  return 'Vendedora';
}

function formatDateOnlyLabel(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function currentUruguayTodayRange(): { from: string; to: string } {
  const today = currentUruguayMonthRange().to;
  return { from: today, to: today };
}
