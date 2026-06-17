import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  History,
  LucideAngularModule,
  LucideIconData,
  Receipt,
  RefreshCw,
  TrendingUp,
  Undo2,
  Wallet,
  X,
  XCircle,
} from 'lucide-angular';

import { BrandColorInput, brandChipColors } from '../../../core/brands/brand-colors';
import {
  CASH_REGISTER_HISTORY_DEFAULT_PAGE_SIZE,
  CashRegisterService,
} from '../../../core/cash-register/cash-register.service';
import {
  CashRegisterBrandTotalResponse,
  CashRegisterSessionResponse,
  CloseCashRegisterRequest,
} from '../../../core/cash-register/cash-register.types';
import { NotificationService } from '../../../core/notifications/notification.service';
import {
  CashPaymentGroup,
  GroupedReconciliationLine,
  groupPaymentTotals,
  groupReconciliationLines,
  groupReconciliationLinesForBrand,
  paymentGroupIcon,
  paymentGroupLabel,
} from '../../../core/cash-register/cash-register.utils';
import { BrandChipComponent } from '../../../shared/components/brand-chip/brand-chip.component';
import {
  formatCurrencyUYU,
  formatShortDate,
  parseBackendUtcDate,
  URUGUAY_TIME_ZONE,
} from '../../shared/inventory/inventory.utils';
import { CashRegisterCloseDialogComponent } from './components/cash-register-close-dialog.component';

interface CashRegisterKpi {
  label: string;
  value: number;
  kind: 'currency' | 'count';
  caption?: string;
  icon: LucideIconData;
  iconWrapClass: string;
}

interface PaymentBreakdownRow {
  group: CashPaymentGroup;
  label: string;
  icon: LucideIconData;
  net: number;
}

@Component({
  selector: 'app-seller-cash-register',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputNumberModule,
    MessageModule,
    TableModule,
    TagModule,
    TextareaModule,
    LucideAngularModule,
    BrandChipComponent,
    CashRegisterCloseDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cash-register.component.html',
})
export class SellerCashRegisterComponent implements OnInit {
  private readonly cashRegister = inject(CashRegisterService);
  private readonly notifications = inject(NotificationService);

  protected readonly icons = {
    AlertTriangle,
    Banknote,
    CheckCircle2,
    Eye,
    EyeOff,
    FileText,
    History,
    Receipt,
    RefreshCw,
    TrendingUp,
    Undo2,
    Wallet,
    X,
    XCircle,
  };

  private readonly reportAnchor = viewChild<ElementRef<HTMLElement>>('reportAnchor');
  private scrollToReportPending = false;

  protected readonly current = this.cashRegister.current;
  protected readonly currentLoaded = this.cashRegister.currentLoaded;
  protected readonly currentLoading = this.cashRegister.currentLoading;
  protected readonly currentError = this.cashRegister.currentError;
  protected readonly selectedReport = this.cashRegister.selectedReport;
  protected readonly reportLoading = this.cashRegister.reportLoading;
  protected readonly reportError = this.cashRegister.reportError;
  protected readonly historyItems = this.cashRegister.historyItems;
  protected readonly historyTotalCount = this.cashRegister.historyTotalCount;
  protected readonly historyPage = this.cashRegister.historyPage;
  protected readonly historyPageSize = this.cashRegister.historyPageSize;
  protected readonly historyLoading = this.cashRegister.historyLoading;
  protected readonly historyError = this.cashRegister.historyError;

  protected readonly submittingOpen = signal(false);
  protected readonly submittingClose = signal(false);
  protected readonly openSubmitError = signal<string | null>(null);
  protected readonly closeSubmitError = signal<string | null>(null);
  protected readonly closeDialogVisible = signal(false);

  protected readonly openForm = new FormGroup({
    openingCashAmount: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  protected readonly maxNotesLength = 500;

  protected readonly summaryKpis = computed<CashRegisterKpi[]>(() => {
    const session = this.current();
    if (!session) return [];

    return [
      {
        label: 'Recaudación total',
        value: session.netSalesAmount,
        kind: 'currency',
        caption: `Bruto ${this.formatCurrency(session.grossSalesAmount)} · Devol ${this.formatCurrency(session.returnsAmount)}`,
        icon: TrendingUp,
        iconWrapClass: 'bg-primary/10 dark:bg-primary/20 text-primary',
      },
      {
        label: 'Caja efectivo',
        value: this.expectedCash(session),
        kind: 'currency',
        caption: `Esperado · inicial ${this.formatCurrency(session.openingCashAmount)}`,
        icon: Banknote,
        iconWrapClass: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300',
      },
      {
        label: 'Ventas',
        value: session.saleCount,
        kind: 'count',
        icon: Receipt,
        iconWrapClass: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-300',
      },
      {
        label: 'Devoluciones',
        value: session.returnCount,
        kind: 'count',
        icon: Undo2,
        iconWrapClass: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300',
      },
    ];
  });

  protected readonly paymentBreakdown = computed<PaymentBreakdownRow[]>(() => {
    const session = this.current();
    if (!session) return [];

    return groupPaymentTotals(session.paymentTotals).map((total) => ({
      group: total.group,
      label: paymentGroupLabel(total.group),
      icon: paymentGroupIcon(total.group),
      net: total.netAmount,
    }));
  });

  constructor() {
    effect(() => {
      const report = this.selectedReport();
      const anchor = this.reportAnchor();
      if (!report || !anchor || !this.scrollToReportPending) return;
      this.scrollToReportPending = false;
      const el = anchor.nativeElement;
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  ngOnInit(): void {
    this.refreshCurrent();
    this.loadHistory();
  }

  protected refreshAll(): void {
    this.refreshCurrent();
    this.loadHistory(this.historyPage(), this.historyPageSize());
  }

  protected refreshCurrent(): void {
    this.cashRegister.loadCurrent().subscribe({
      error: () => {
        // error.interceptor already shows a toast.
      },
    });
  }

  protected submitOpen(): void {
    if (this.submittingOpen()) return;
    if (this.openForm.invalid) {
      this.openForm.markAllAsTouched();
      return;
    }

    const raw = this.openForm.getRawValue();
    const openingCashAmount = raw.openingCashAmount ?? 0;
    const notes = this.normalizeNotes(raw.notes);

    this.openSubmitError.set(null);
    this.submittingOpen.set(true);
    this.cashRegister.open({ openingCashAmount, notes }).subscribe({
      next: () => {
        this.submittingOpen.set(false);
        this.openForm.reset({ openingCashAmount: null, notes: '' });
        this.notifications.success('Caja abierta.');
      },
      error: () => {
        this.submittingOpen.set(false);
        this.openSubmitError.set('No se pudo abrir la caja. Revisá los datos e intentá de nuevo.');
      },
    });
  }

  protected openCloseDialog(): void {
    this.closeSubmitError.set(null);
    this.closeDialogVisible.set(true);
  }

  protected closeCurrent(req: CloseCashRegisterRequest): void {
    const session = this.current();
    if (!session || this.submittingClose()) return;

    this.closeSubmitError.set(null);
    this.submittingClose.set(true);
    this.cashRegister.close(session.id, req).subscribe({
      next: () => {
        this.submittingClose.set(false);
        this.closeDialogVisible.set(false);
        this.notifications.success('Caja cerrada.');
        this.loadHistory(1, this.historyPageSize());
      },
      error: () => {
        this.submittingClose.set(false);
        this.closeSubmitError.set('No se pudo cerrar la caja. Revisá los importes informados.');
      },
    });
  }

  protected viewReport(id: string): void {
    if (this.isReportShown(id)) {
      this.hideReport();
      return;
    }

    this.scrollToReportPending = true;
    this.cashRegister.getById(id).subscribe({
      error: () => {
        this.scrollToReportPending = false;
        // error.interceptor already shows a toast.
      },
    });
  }

  protected hideReport(): void {
    this.scrollToReportPending = false;
    this.cashRegister.clearSelectedReport();
  }

  protected isReportShown(id: string): boolean {
    return this.selectedReport()?.id === id;
  }

  protected onHistoryLazyLoad(event: TableLazyLoadEvent): void {
    const pageSize = event.rows ?? CASH_REGISTER_HISTORY_DEFAULT_PAGE_SIZE;
    const page = Math.floor((event.first ?? 0) / pageSize) + 1;
    this.loadHistory(page, pageSize);
  }

  private loadHistory(page = 1, pageSize = CASH_REGISTER_HISTORY_DEFAULT_PAGE_SIZE): void {
    this.cashRegister.loadHistory({ page, pageSize }).subscribe({
      error: () => {
        // error.interceptor already shows a toast.
      },
    });
  }

  protected isOpeningCashInvalid(): boolean {
    const control = this.openForm.controls.openingCashAmount;
    return control.invalid && (control.touched || control.dirty);
  }

  protected isOpeningNotesInvalid(): boolean {
    const control = this.openForm.controls.notes;
    return control.invalid && (control.touched || control.dirty);
  }

  protected get openingNotesLength(): number {
    return this.openForm.controls.notes.value.length;
  }

  protected groupLabel(group: CashPaymentGroup): string {
    return paymentGroupLabel(group);
  }

  protected groupIcon(group: CashPaymentGroup): LucideIconData {
    return paymentGroupIcon(group);
  }

  protected brandAccentStyle(brand: BrandColorInput): Record<string, string> {
    return { 'border-left-color': brandChipColors(brand).border };
  }

  protected groupedPaymentTotals(session: CashRegisterSessionResponse) {
    return groupPaymentTotals(session.paymentTotals);
  }

  protected groupedReconciliation(session: CashRegisterSessionResponse): GroupedReconciliationLine[] {
    return groupReconciliationLines(session.reconciliationLines);
  }

  protected groupedLinesForBrand(
    session: CashRegisterSessionResponse,
    brandId: string,
  ): GroupedReconciliationLine[] {
    return groupReconciliationLinesForBrand(session.reconciliationLines, brandId);
  }

  protected expectedCash(session: CashRegisterSessionResponse): number {
    return session.expectedCashAmount ?? session.openingCashAmount;
  }

  protected formatKpi(kpi: CashRegisterKpi): string {
    return kpi.kind === 'currency' ? this.formatCurrency(kpi.value) : this.formatNumber(kpi.value);
  }

  protected formatCurrency(value: number | null | undefined): string {
    return formatCurrencyUYU(value ?? 0);
  }

  protected formatSignedCurrency(value: number | null | undefined): string {
    const amount = value ?? 0;
    const formatted = this.formatCurrency(Math.abs(amount));
    if (amount > 0) return `+${formatted}`;
    if (amount < 0) return `-${formatted}`;
    return formatted;
  }

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat('es-UY').format(value);
  }

  protected formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return formatShortDate(iso);
  }

  protected formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('es-UY', {
      timeZone: URUGUAY_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(parseBackendUtcDate(iso));
  }

  protected statusLabel(status: string): string {
    return status === 'Open' ? 'Abierta' : 'Cerrada';
  }

  protected statusSeverity(status: string): 'success' | 'secondary' {
    return status === 'Open' ? 'success' : 'secondary';
  }

  protected varianceClass(value: number | null | undefined): string {
    const amount = value ?? 0;
    if (amount > 0) return 'text-emerald-700 dark:text-emerald-300';
    if (amount < 0) return 'text-red-600 dark:text-red-300';
    return 'text-surface-600 dark:text-surface-300';
  }

  protected varianceIcon(value: number | null | undefined) {
    const amount = value ?? 0;
    if (amount > 0) return AlertTriangle;
    if (amount < 0) return XCircle;
    return CheckCircle2;
  }

  protected brandLineCountLabel(brand: CashRegisterBrandTotalResponse): string {
    return `${this.formatNumber(brand.saleCount)} ventas · ${this.formatNumber(
      brand.returnCount,
    )} devoluciones`;
  }

  private normalizeNotes(value: string): string | null {
    const notes = value.trim();
    return notes.length > 0 ? notes : null;
  }
}
