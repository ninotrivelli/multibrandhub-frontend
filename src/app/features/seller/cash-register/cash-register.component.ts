import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
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
  CheckCircle2,
  Eye,
  FileText,
  History,
  LucideAngularModule,
  RefreshCw,
  XCircle,
} from 'lucide-angular';

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
import { PaymentMethod } from '../../../core/sales/sales.types';
import { paymentMethodLabel } from '../../../core/sales/sales.utils';
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
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'CreditCard',
  'DebitCard',
  'Transfer',
  'MercadoPago',
];

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
    CheckCircle2,
    Eye,
    FileText,
    History,
    RefreshCw,
    XCircle,
  };

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

  protected readonly kpis = computed<CashRegisterKpi[]>(() => {
    const session = this.current();
    if (!session) return [];

    return [
      {
        label: 'Caja efectivo',
        value: this.expectedCash(session),
        kind: 'currency',
        caption: 'Esperado',
      },
      { label: 'Crédito', value: this.paymentTotal(session, 'CreditCard'), kind: 'currency' },
      { label: 'Débito', value: this.paymentTotal(session, 'DebitCard'), kind: 'currency' },
      {
        label: 'Transferencias',
        value: this.paymentTotal(session, 'Transfer'),
        kind: 'currency',
      },
      {
        label: 'MercadoPago',
        value: this.paymentTotal(session, 'MercadoPago'),
        kind: 'currency',
      },
      { label: 'Recaudación total', value: session.netSalesAmount, kind: 'currency' },
      { label: 'Ventas', value: session.saleCount, kind: 'count' },
      { label: 'Devoluciones', value: session.returnCount, kind: 'count' },
    ];
  });

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
    this.cashRegister.getById(id).subscribe({
      error: () => {
        // error.interceptor already shows a toast.
      },
    });
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

  protected paymentLabel(method: PaymentMethod): string {
    return paymentMethodLabel(method);
  }

  protected paymentMethods(): PaymentMethod[] {
    return PAYMENT_METHODS;
  }

  protected paymentTotal(session: CashRegisterSessionResponse, method: PaymentMethod): number {
    return session.paymentTotals.find((total) => total.paymentMethod === method)?.netAmount ?? 0;
  }

  protected paymentLinesForBrand(session: CashRegisterSessionResponse, brandId: string) {
    return session.reconciliationLines.filter((line) => line.brandId === brandId);
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
