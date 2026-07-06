import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import {
  BadgeDollarSign,
  Calculator,
  CheckCircle2,
  Eye,
  FileDown,
  History,
  LucideAngularModule,
  RefreshCw,
} from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';
import { BrandsService } from '../../../core/brands/brands.service';
import { BrandResponse } from '../../../core/brands/brands.types';
import { contractTypeLabel } from '../../../core/brands/brands.utils';
import { NotificationService } from '../../../core/notifications/notification.service';
import { SettlementsService } from '../../../core/settlements/settlements.service';
import {
  BrandSettlementSavedResponse,
  MarkBrandSettlementPaidRequest,
  PagedResult,
  SavedBrandSettlementSearchRequest,
  SettlementFinancialStatus,
  SettlementOperationalStatus,
} from '../../../core/settlements/settlements.types';
import { formatCurrencyUYU, formatMovementDate } from '../inventory/inventory.utils';
import {
  formatRangeSummary,
  formatShortDateOnly,
  normalizeDateRange,
} from '../sales-dashboard/sales-dashboard.utils';
import {
  OPERATIONAL_STATUS_OPTIONS,
  SettlementPeriodPreset,
  currentFullMonthRange,
  currentLocalDateTimeInput,
  dateOnly,
  formatRelativeTimeAgo,
  settlementDirectionAmountClasses,
  settlementDirectionLabel,
  settlementDirectionSeverity,
  settlementOperationalStatusLabel,
  settlementOperationalStatusSeverity,
  settlementPeriodOptionsForCurrentYear,
  settlementPeriodRangeForPreset,
} from './settlements.utils';

export type SettlementsShellVariant = 'admin' | 'brand-manager';

interface BrandOption {
  label: string;
  value: string;
}

type SettlementTableRow = BrandSettlementSavedResponse & {
  generationGroupKey: string;
};

@Component({
  selector: 'app-settlements-shell',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    TextareaModule,
    ToggleSwitchModule,
    TooltipModule,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settlements-shell.component.html',
})
export class SettlementsShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly brands = inject(BrandsService);
  private readonly settlements = inject(SettlementsService);
  private readonly notifications = inject(NotificationService);

  readonly variant = input.required<SettlementsShellVariant>();

  protected readonly icons = {
    BadgeDollarSign,
    Calculator,
    CheckCircle2,
    Eye,
    FileDown,
    History,
    RefreshCw,
  };

  protected readonly periodOptions = settlementPeriodOptionsForCurrentYear();
  protected readonly statusOptions = OPERATIONAL_STATUS_OPTIONS;
  protected readonly currentUser = this.auth.user;
  protected readonly brandsList = this.brands.items;
  protected readonly loadingBrands = this.brands.loading;

  protected readonly periodPreset = signal<SettlementPeriodPreset>('currentMonth');
  protected readonly startDate = signal(currentFullMonthRange().startDate);
  protected readonly endDate = signal(currentFullMonthRange().endDate);
  protected readonly selectedBrandId = signal<string | null>(null);
  protected readonly selectedStatus = signal<SettlementOperationalStatus | null>(null);
  protected readonly includeSuperseded = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);

  protected readonly saved = signal<PagedResult<BrandSettlementSavedResponse> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mutatingSettlementId = signal<string | null>(null);
  protected readonly existingCurrentForSelectedBrand = signal<BrandSettlementSavedResponse | null>(
    null,
  );

  protected readonly detailVisible = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal<string | null>(null);
  protected readonly selectedSettlement = signal<BrandSettlementSavedResponse | null>(null);
  protected readonly versionsVisible = signal(false);
  protected readonly versionsLoading = signal(false);
  protected readonly versions = signal<BrandSettlementSavedResponse[] | null>(null);

  protected readonly generateDialogVisible = signal(false);
  protected readonly generateNotes = signal('');
  protected readonly generating = signal(false);

  protected readonly markPaidDialogVisible = signal(false);
  protected readonly markPaidTarget = signal<BrandSettlementSavedResponse | null>(null);
  protected readonly paidAtLocal = signal('');
  protected readonly paymentReference = signal('');
  protected readonly paymentNotes = signal('');
  protected readonly markingPaid = signal(false);

  private readonly searchTrigger$ = new Subject<SavedBrandSettlementSearchRequest>();
  private readonly existenceTrigger$ = new Subject<SavedBrandSettlementSearchRequest | null>();
  private readonly detailTrigger$ = new Subject<string>();
  private readonly versionsTrigger$ = new Subject<string>();

  protected readonly isAdmin = computed(() => this.variant() === 'admin');
  protected readonly isBrandManager = computed(() => this.variant() === 'brand-manager');
  protected readonly brandManagerBrandId = computed(() =>
    this.isBrandManager() ? (this.currentUser()?.brandId ?? null) : null,
  );
  protected readonly missingBrandScope = computed(
    () => this.isBrandManager() && !this.brandManagerBrandId(),
  );

  protected readonly requestBrandId = computed(
    () => this.brandManagerBrandId() ?? this.selectedBrandId(),
  );

  protected readonly currentRequest = computed<SavedBrandSettlementSearchRequest | null>(() => {
    if (this.missingBrandScope()) return null;

    return {
      from: this.startDate(),
      to: this.endDate(),
      brandId: this.requestBrandId() ?? undefined,
      status: this.selectedStatus() ?? undefined,
      includeSuperseded: this.includeSuperseded(),
      page: this.page(),
      pageSize: this.pageSize(),
    };
  });

  protected readonly selectedBrand = computed(() => {
    const id = this.requestBrandId();
    return id ? (this.brandsList().find((brand) => brand.id === id) ?? null) : null;
  });

  protected readonly brandOptions = computed<BrandOption[]>(() =>
    this.brandsList()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
      .map((brand) => ({
        label: brand.status === 'Archived' ? `${brand.name} (dada de baja)` : brand.name,
        value: brand.id,
      })),
  );

  protected readonly rangeLabel = computed(() =>
    formatRangeSummary(this.startDate(), this.endDate()),
  );

  /** Rows fed to the table. Backend ordering is preserved so grouped pages stay intact. */
  protected readonly tableRows = computed<SettlementTableRow[]>(() => {
    const items = this.saved()?.items ?? [];
    return items.map((item) => ({
      ...item,
      generationGroupKey: this.generationGroupKey(item),
    }));
  });

  protected readonly tablePaginatorTotalRecords = computed(() => {
    const saved = this.saved();
    if (!saved) return 0;
    if (!this.includeSuperseded()) return saved.totalCount;

    const totalPages =
      saved.totalPages ?? Math.ceil(saved.totalCount / Math.max(saved.pageSize, 1));
    return totalPages <= 0 ? 0 : totalPages * this.pageSize();
  });

  protected readonly pageReportTemplate = computed(() =>
    this.includeSuperseded()
      ? 'Página {currentPage} de {totalPages}'
      : 'Mostrando {first} a {last} de {totalRecords} liquidaciones',
  );

  /** Most recent generation timestamp among the loaded settlements, if any. */
  protected readonly lastCalculatedAtUtc = computed<string | null>(() => {
    const items = this.saved()?.items ?? [];
    if (items.length === 0) return null;
    return items.reduce(
      (latest, item) => (item.generatedAtUtc > latest ? item.generatedAtUtc : latest),
      items[0].generatedAtUtc,
    );
  });

  protected readonly generateButtonLabel = computed(() => {
    if (!this.selectedBrandId()) return 'Generar/Recalcular';
    return this.existingCurrentForSelectedBrand() ? 'Recalcular' : 'Generar';
  });

  protected readonly canConfirmMarkPaid = computed(
    () =>
      this.paymentReference().trim().length <= 100 &&
      this.paymentNotes().trim().length <= 500 &&
      !this.markingPaid(),
  );

  constructor() {
    this.searchTrigger$
      .pipe(
        switchMap((request) => {
          this.loading.set(true);
          this.error.set(null);
          return this.settlements.searchSaved(request).pipe(
            tap({
              next: (response) => {
                this.saved.set(response);
                this.loading.set(false);
              },
              error: () => {
                this.error.set('No se pudieron cargar las liquidaciones. Probá de nuevo.');
                this.loading.set(false);
              },
            }),
            catchError(() => EMPTY),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.existenceTrigger$
      .pipe(
        switchMap((request) => {
          this.existingCurrentForSelectedBrand.set(null);
          if (!request) return EMPTY;

          return this.settlements.searchSaved(request).pipe(
            tap({
              next: (response) => {
                this.existingCurrentForSelectedBrand.set(
                  this.findExactCurrentForRequest(response.items, request),
                );
              },
              error: () => {
                this.existingCurrentForSelectedBrand.set(null);
              },
            }),
            catchError(() => EMPTY),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.detailTrigger$
      .pipe(
        switchMap((id) => {
          this.selectedSettlement.set(null);
          this.detailError.set(null);
          this.detailLoading.set(true);
          this.versionsVisible.set(false);
          this.versions.set(null);
          return this.settlements.getSavedById(id).pipe(
            tap({
              next: (response) => {
                this.selectedSettlement.set(response);
                this.detailLoading.set(false);
              },
              error: () => {
                this.detailError.set('No se pudo cargar el detalle de la liquidación.');
                this.detailLoading.set(false);
              },
            }),
            catchError(() => EMPTY),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.versionsTrigger$
      .pipe(
        switchMap((id) => {
          this.versionsLoading.set(true);
          return this.settlements.getVersions(id).pipe(
            tap({
              next: (response) => {
                this.versions.set(response);
                this.versionsLoading.set(false);
              },
              error: () => {
                this.notifications.error('No se pudieron cargar las versiones.');
                this.versionsLoading.set(false);
              },
            }),
            catchError(() => EMPTY),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    effect(() => {
      const request = this.currentRequest();
      if (!request) return;
      untracked(() => this.searchTrigger$.next(request));
    });

    effect(() => {
      if (!this.isAdmin()) return;
      const brandId = this.selectedBrandId();
      if (!brandId) {
        untracked(() => this.existenceTrigger$.next(null));
        return;
      }

      const request: SavedBrandSettlementSearchRequest = {
        from: this.startDate(),
        to: this.endDate(),
        brandId,
        includeSuperseded: false,
        page: 1,
        pageSize: 100,
      };
      untracked(() => this.existenceTrigger$.next(request));
    });
  }

  ngOnInit(): void {
    if (!this.brands.hasItems()) {
      this.brands.list({ page: 1, pageSize: 100, includeArchived: true }).subscribe({
        error: () => {
          // The global interceptor shows the toast.
        },
      });
    }
  }

  protected setPeriodPreset(preset: SettlementPeriodPreset): void {
    this.periodPreset.set(preset);
    if (preset !== 'custom') {
      const range = settlementPeriodRangeForPreset(preset);
      this.applyDateRange(range.startDate, range.endDate);
    }
  }

  protected setCustomStartDate(value: string): void {
    if (!value) return;
    this.periodPreset.set('custom');
    const range = normalizeDateRange(value, this.endDate());
    this.applyDateRange(range.startDate, range.endDate);
  }

  protected setCustomEndDate(value: string): void {
    if (!value) return;
    this.periodPreset.set('custom');
    const range = normalizeDateRange(this.startDate(), value);
    this.applyDateRange(range.startDate, range.endDate);
  }

  protected onBrandFilterChange(value: string | null): void {
    this.selectedBrandId.set(value);
    this.page.set(1);
  }

  protected onStatusFilterChange(value: SettlementOperationalStatus | null): void {
    this.selectedStatus.set(value);
    this.page.set(1);
  }

  protected onIncludeSupersededChange(value: boolean): void {
    this.includeSuperseded.set(value);
    this.page.set(1);
  }

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const nextPageSize = event.rows ?? 20;
    const nextPage = Math.floor((event.first ?? 0) / nextPageSize) + 1;
    this.page.set(nextPage);
    this.pageSize.set(nextPageSize);
  }

  protected refresh(): void {
    const request = this.currentRequest();
    if (!request) return;
    this.searchTrigger$.next(request);
    this.refreshExistingCurrent();
  }

  protected openGenerateDialog(): void {
    if (!this.isAdmin()) return;
    this.generateNotes.set('');
    this.generateDialogVisible.set(true);
  }

  protected onGenerateDialogVisibleChange(value: boolean): void {
    if (!value && this.generating()) return;
    this.generateDialogVisible.set(value);
  }

  protected confirmGenerate(): void {
    if (!this.isAdmin() || this.generating()) return;

    const notes = this.generateNotes().trim();
    this.generating.set(true);
    this.settlements
      .generate({
        from: this.startDate(),
        to: this.endDate(),
        brandId: this.selectedBrandId() ?? undefined,
        notes: notes.length > 0 ? notes : null,
      })
      .subscribe({
        next: (response) => {
          this.generating.set(false);
          this.generateDialogVisible.set(false);
          this.notifications.success(this.generateSuccessMessage(response.length));
          this.refresh();
        },
        error: () => {
          this.generating.set(false);
        },
      });
  }

  protected openDetail(row: BrandSettlementSavedResponse): void {
    this.detailVisible.set(true);
    this.detailTrigger$.next(row.id);
  }

  protected onDetailVisibleChange(value: boolean): void {
    this.detailVisible.set(value);
    if (!value) {
      this.selectedSettlement.set(null);
      this.detailError.set(null);
      this.versionsVisible.set(false);
      this.versions.set(null);
    }
  }

  protected toggleVersions(): void {
    const detail = this.selectedSettlement();
    if (!detail || this.versionsLoading()) return;

    const nextVisible = !this.versionsVisible();
    this.versionsVisible.set(nextVisible);
    if (nextVisible && !this.versions()) this.versionsTrigger$.next(detail.id);
  }

  protected selectVersion(version: BrandSettlementSavedResponse): void {
    this.selectedSettlement.set(version);
  }

  /**
   * Front-end only "Descargar PDF": names the document so the browser's
   * Save-as-PDF dialog defaults to a meaningful filename, then triggers the
   * native print flow. The print stylesheet isolates `#settlement-print`.
   */
  protected downloadSettlementPdf(): void {
    const settlement = this.selectedSettlement();
    if (!settlement || typeof window === 'undefined') return;

    const originalTitle = document.title;
    document.title = this.printFileName(settlement);
    const restore = (): void => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  }

  private printFileName(settlement: BrandSettlementSavedResponse): string {
    const brand = settlement.brandName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
    return `Liquidacion_${brand}_${dateOnly(settlement.from)}_v${settlement.versionNumber}`;
  }

  protected canFinalize(row: BrandSettlementSavedResponse): boolean {
    return this.isAdmin() && row.isCurrent && row.status === 'Draft';
  }

  protected canMarkPaid(row: BrandSettlementSavedResponse): boolean {
    return this.isAdmin() && row.isCurrent && row.status === 'Finalized';
  }

  protected finalize(row: BrandSettlementSavedResponse): void {
    if (!this.canFinalize(row) || this.mutatingSettlementId()) return;

    this.mutatingSettlementId.set(row.id);
    this.settlements.finalize(row.id).subscribe({
      next: (updated) => {
        this.mutatingSettlementId.set(null);
        this.notifications.success('La liquidación quedó finalizada.', 'Liquidación finalizada');
        this.onSettlementUpdated(updated);
      },
      error: () => {
        this.mutatingSettlementId.set(null);
      },
    });
  }

  protected openMarkPaid(row: BrandSettlementSavedResponse): void {
    if (!this.canMarkPaid(row)) return;

    this.markPaidTarget.set(row);
    this.paidAtLocal.set(currentLocalDateTimeInput());
    this.paymentReference.set('');
    this.paymentNotes.set('');
    this.markPaidDialogVisible.set(true);
  }

  protected onMarkPaidDialogVisibleChange(value: boolean): void {
    if (!value && this.markingPaid()) return;
    this.markPaidDialogVisible.set(value);
    if (!value) this.markPaidTarget.set(null);
  }

  protected confirmMarkPaid(): void {
    const target = this.markPaidTarget();
    if (!target || !this.canConfirmMarkPaid()) return;

    const request: MarkBrandSettlementPaidRequest = {
      paymentReference: this.nullableTrim(this.paymentReference()),
      notes: this.nullableTrim(this.paymentNotes()),
    };
    if (this.paidAtLocal()) {
      request.paidAtUtc = new Date(this.paidAtLocal()).toISOString();
    }

    this.markingPaid.set(true);
    this.settlements.markPaid(target.id, request).subscribe({
      next: (updated) => {
        this.markingPaid.set(false);
        this.markPaidDialogVisible.set(false);
        this.markPaidTarget.set(null);
        this.notifications.success('La liquidación quedó marcada como pagada.', 'Pago registrado');
        this.onSettlementUpdated(updated);
      },
      error: () => {
        this.markingPaid.set(false);
      },
    });
  }

  protected isMutating(row: BrandSettlementSavedResponse): boolean {
    return this.mutatingSettlementId() === row.id;
  }

  protected isOwnBrand(brandId: string): boolean {
    return this.currentUser()?.brandId === brandId;
  }

  protected statusLabel(status: SettlementOperationalStatus): string {
    return settlementOperationalStatusLabel(status);
  }

  protected statusSeverity(
    status: SettlementOperationalStatus,
  ): 'success' | 'info' | 'warn' | 'secondary' {
    return settlementOperationalStatusSeverity(status);
  }

  protected directionLabel(status: SettlementFinancialStatus): string {
    return settlementDirectionLabel(status);
  }

  protected directionSeverity(
    status: SettlementFinancialStatus,
  ): 'success' | 'info' | 'warn' | 'secondary' {
    return settlementDirectionSeverity(status);
  }

  protected directionAmountClasses(status: SettlementFinancialStatus): string {
    return settlementDirectionAmountClasses(status);
  }

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }

  protected formatAbsoluteCurrency(value: number): string {
    return formatCurrencyUYU(Math.abs(value));
  }

  protected formatPercent(value: number): string {
    return `${new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 }).format(value)}%`;
  }

  protected commissionFormula(row: BrandSettlementSavedResponse): string {
    return `${this.formatPercent(row.commissionPercentage)} de ${this.formatCurrency(row.netSalesAmount)} = ${this.formatCurrency(row.commissionAmount)}`;
  }

  protected platformFeeFormula(row: BrandSettlementSavedResponse): string {
    return `${this.formatCurrency(row.commissionAmount)} + ${this.formatCurrency(row.fixedAmount)} = ${this.formatCurrency(row.platformFee)}`;
  }

  protected nonCashFormula(row: BrandSettlementSavedResponse): string {
    return `${this.formatCurrency(row.netSalesAmount)} - ${this.formatCurrency(row.cashCollectedByStore)} = ${this.formatCurrency(row.nonCashCollectedByBrand)}`;
  }

  protected balanceFormula(row: BrandSettlementSavedResponse): string {
    return `${this.formatCurrency(row.platformFee)} - ${this.formatCurrency(row.cashCollectedByStore)} = ${this.formatCurrency(row.amountBrandOwesStore)}`;
  }

  protected balanceExplanation(row: BrandSettlementSavedResponse): string {
    if (row.amountBrandOwesStore > 0) {
      return 'El efectivo retenido por el local no cubre todo lo que el local tiene que cobrar. La marca debe pagar esa diferencia.';
    }

    if (row.amountBrandOwesStore < 0) {
      return 'El local ya retuvo más efectivo que su total a cobrar. La diferencia queda a favor de la marca y el local debe transferirla.';
    }

    return 'El efectivo retenido coincide exactamente con lo que el local tiene que cobrar. No queda saldo pendiente.';
  }

  protected formatDate(value: string): string {
    return formatShortDateOnly(dateOnly(value));
  }

  protected formatDateTime(value: string | null): string {
    return value ? formatMovementDate(value) : '—';
  }

  protected relativeTimeAgo(value: string): string {
    return formatRelativeTimeAgo(value);
  }

  protected periodLabel(row: BrandSettlementSavedResponse): string {
    return `${this.formatDate(row.from)} al ${this.formatDate(row.to)}`;
  }

  protected versionTagLabel(row: BrandSettlementSavedResponse): string {
    return `v${row.versionNumber} · ${row.isCurrent ? 'Vigente' : 'Anterior'}`;
  }

  protected versionGroupLabel(row: BrandSettlementSavedResponse): string {
    return `Versión ${row.versionNumber} · ${this.periodLabel(row)}`;
  }

  protected contractLabel(row: BrandSettlementSavedResponse): string {
    return contractTypeLabel(row.contractType);
  }

  private applyDateRange(startDate: string, endDate: string): void {
    this.startDate.set(startDate);
    this.endDate.set(endDate);
    this.page.set(1);
  }

  private refreshExistingCurrent(): void {
    if (!this.isAdmin() || !this.selectedBrandId()) return;
    this.existenceTrigger$.next({
      from: this.startDate(),
      to: this.endDate(),
      brandId: this.selectedBrandId() ?? undefined,
      includeSuperseded: false,
      page: 1,
      pageSize: 100,
    });
  }

  private generationGroupKey(row: BrandSettlementSavedResponse): string {
    if (row.generationBatchId) return `batch:${row.generationBatchId}`;

    return [
      'legacy',
      dateOnly(row.from),
      dateOnly(row.to),
      row.versionNumber,
      row.generatedAtUtc,
      row.generatedByUserId,
    ].join(':');
  }

  private findExactCurrentForRequest(
    items: BrandSettlementSavedResponse[],
    request: SavedBrandSettlementSearchRequest,
  ): BrandSettlementSavedResponse | null {
    return (
      items.find(
        (item) =>
          item.isCurrent &&
          dateOnly(item.from) === request.from &&
          dateOnly(item.to) === request.to &&
          (!request.brandId || item.brandId === request.brandId),
      ) ?? null
    );
  }

  private generateSuccessMessage(count: number): string {
    if (this.selectedBrandId()) {
      const action = this.generateButtonLabel().toLowerCase();
      return `Se ${action === 'recalcular' ? 'recalculó' : 'generó'} la liquidación.`;
    }

    return count === 1
      ? 'Se generó 1 liquidación.'
      : `Se generaron/recalcularon ${count} liquidaciones.`;
  }

  private onSettlementUpdated(updated: BrandSettlementSavedResponse): void {
    if (this.selectedSettlement()?.id === updated.id) {
      this.selectedSettlement.set(updated);
    }
    this.refresh();
  }

  private nullableTrim(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
