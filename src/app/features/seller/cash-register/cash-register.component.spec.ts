import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { of, throwError } from 'rxjs';

import {
  makeCashRegisterMovement,
  makeCashRegisterSession,
  makeCashRegisterSummary,
  makeClosedCashRegisterSession,
  paged,
} from '../../../../testing/builders';
import { CashRegisterService } from '../../../core/cash-register/cash-register.service';
import {
  CashRegisterSessionResponse,
  CashRegisterSessionSummaryResponse,
} from '../../../core/cash-register/cash-register.types';
import { NotificationService } from '../../../core/notifications/notification.service';
import { DEFAULT_PRESET } from '../../../core/theme/theme.presets';
import { notificationServiceMock } from '../../../../testing/service-mocks';
import { SellerCashRegisterComponent } from './cash-register.component';
import { CashRegisterCloseDialogComponent } from './components/cash-register-close-dialog.component';
import { CashRegisterMovementDialogComponent } from './components/cash-register-movement-dialog.component';

describe('SellerCashRegisterComponent', () => {
  let fixture: ComponentFixture<SellerCashRegisterComponent>;
  let cashRegister: ReturnType<typeof cashRegisterServiceMock>;
  let notifications: ReturnType<typeof notificationServiceMock>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    cashRegister = cashRegisterServiceMock();
    notifications = notificationServiceMock();

    TestBed.configureTestingModule({
      imports: [SellerCashRegisterComponent],
      providers: [
        { provide: CashRegisterService, useValue: cashRegister },
        { provide: NotificationService, useValue: notifications },
        providePrimeNG({
          theme: {
            preset: DEFAULT_PRESET,
          },
        }),
      ],
    });
  });

  function create(): void {
    fixture = TestBed.createComponent(SellerCashRegisterComponent);
    fixture.detectChanges();
  }

  it('renders the ready state when there is no open register', async () => {
    cashRegister.currentLoaded.set(true);
    cashRegister.current.set(null);

    create();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Caja');
    expect(text).toContain('Lista para abrir');
    expect(text).toContain('Abrir Caja');
    expect(cashRegister.loadCurrent).toHaveBeenCalled();
    expect(cashRegister.loadHistory).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  it('renders open register KPIs and close CTA', async () => {
    cashRegister.currentLoaded.set(true);
    cashRegister.current.set(makeCashRegisterSession());

    create();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    const normalizedText = text.replace(/\s+/g, ' ');
    expect(text).toContain('Caja abierta');
    expect(text).toContain('Caja efectivo');
    expect(text).toContain('(Esperado)');
    expect(normalizedText).toContain('Inicial: $ 1.000');
    expect(text).toContain('Entradas manuales');
    expect(text).toContain('Salidas manuales');
    expect(text).toContain('Recaudación total');
    expect(text).toContain('Registrar movimiento');
    expect(text).toContain('Cerrar Caja');
    expect(text).toContain('Zendra');
    expect(text).toContain('Lumina');
  });

  it('renders an old open register as requiring closure with its exact age', async () => {
    cashRegister.currentLoaded.set(true);
    cashRegister.current.set(makeCashRegisterSession({ openedAtUtc: '2026-07-09T11:00:00Z' }));
    cashRegister.currentAgeText.set('hace 10 días');
    cashRegister.hasStaleOpenRegister.set(true);

    create();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Caja abierta hace 10 días');
    expect(text).toContain('Requiere cierre');
    expect(text).toContain('Cerrala para comenzar un nuevo día');
    expect(text).toContain('Cerrar Caja');
  });

  it('renders manual movements in the open register view', async () => {
    cashRegister.currentLoaded.set(true);
    cashRegister.current.set(
      makeCashRegisterSession({
        manualCashInAmount: 250,
        manualCashOutAmount: 150,
        manualCashNetAmount: 100,
        movements: [
          makeCashRegisterMovement(),
          makeCashRegisterMovement({
            id: 'cash-movement-2',
            type: 'CashOut',
            amount: 150,
            signedAmount: -150,
            description: 'Pago distribuidor',
            notes: 'Factura D-100',
          }),
        ],
      }),
    );

    create();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Movimientos manuales');
    expect(text).toContain('Refuerzo de caja');
    expect(text).toContain('Pago distribuidor');
    expect(text).toContain('Factura D-100');
    expect(text).toContain('Neto manual');
  });

  it('creates manual movements with the current session id', () => {
    const session = makeCashRegisterSession({ id: 'cash-session-open' });
    cashRegister.currentLoaded.set(true);
    cashRegister.current.set(session);

    create();
    const component = fixture.componentInstance as unknown as {
      createManualMovement(req: {
        type: 'CashIn' | 'CashOut';
        amount: number;
        description: string;
        notes?: string | null;
      }): void;
      movementDialogVisible: { set(value: boolean): void; (): boolean };
    };

    component.movementDialogVisible.set(true);
    component.createManualMovement({
      type: 'CashOut',
      amount: 150,
      description: 'Pago distribuidor',
      notes: null,
    });

    expect(cashRegister.createMovement).toHaveBeenCalledWith('cash-session-open', {
      type: 'CashOut',
      amount: 150,
      description: 'Pago distribuidor',
      notes: null,
    });
    expect(component.movementDialogVisible()).toBe(false);
  });

  it('renders a closed report with variance and reconciliation lines', async () => {
    cashRegister.currentLoaded.set(true);
    cashRegister.current.set(null);
    cashRegister.selectedReport.set(
      makeClosedCashRegisterSession({
        manualCashOutAmount: 150,
        manualCashNetAmount: -150,
        movements: [
          makeCashRegisterMovement({
            type: 'CashOut',
            amount: 150,
            signedAmount: -150,
            description: 'Pago distribuidor',
          }),
        ],
      }),
    );

    create();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Reporte de caja');
    expect(text).toContain('Diferencia efectivo');
    expect(text).toContain('Movimientos manuales');
    expect(text).toContain('Pago distribuidor');
    expect(text).toContain('Conciliación');
    expect(text).toContain('Lumina');
    expect(text).toContain('+');
  });

  it('toggles the selected report when pressing the history action twice', () => {
    const report = makeClosedCashRegisterSession();
    cashRegister.currentLoaded.set(true);
    cashRegister.current.set(null);

    create();
    const component = fixture.componentInstance as unknown as {
      viewReport(id: string): void;
    };

    // First press loads the report.
    component.viewReport(report.id);
    expect(cashRegister.getById).toHaveBeenCalledWith(report.id);
    expect(cashRegister.clearSelectedReport).not.toHaveBeenCalled();

    // While it is shown, pressing again hides it instead of reloading.
    cashRegister.selectedReport.set(report);
    component.viewReport(report.id);
    expect(cashRegister.clearSelectedReport).toHaveBeenCalled();
    expect(cashRegister.getById).toHaveBeenCalledTimes(1);
  });

  it('validates opening data, then opens a register with normalized notes', () => {
    cashRegister.currentLoaded.set(true);
    create();
    const component = fixture.componentInstance as any;

    component.submitOpen();
    expect(component.isOpeningCashInvalid()).toBe(true);
    expect(cashRegister.open).not.toHaveBeenCalled();

    component.openForm.setValue({ openingCashAmount: 0, notes: '   ' });
    component.submitOpen();

    expect(cashRegister.open).toHaveBeenCalledWith({ openingCashAmount: 0, notes: null });
    expect(component.submittingOpen()).toBe(false);
    expect(notifications.success).toHaveBeenCalledWith('Caja abierta.');
  });

  it('blocks duplicate opening and surfaces an opening failure', () => {
    cashRegister.currentLoaded.set(true);
    cashRegister.open.mockReturnValue(throwError(() => new Error('open failed')));
    create();
    const component = fixture.componentInstance as any;
    component.openForm.setValue({ openingCashAmount: 1000, notes: '  Turno tarde  ' });
    component.submittingOpen.set(true);
    component.submitOpen();
    expect(cashRegister.open).not.toHaveBeenCalled();

    component.submittingOpen.set(false);
    component.submitOpen();
    expect(cashRegister.open).toHaveBeenCalledWith({
      openingCashAmount: 1000,
      notes: 'Turno tarde',
    });
    expect(component.openSubmitError()).toContain('No se pudo abrir');
  });

  it('blocks movements without a session or while submitting and reports failures', () => {
    cashRegister.currentLoaded.set(true);
    create();
    const component = fixture.componentInstance as any;
    const request = {
      type: 'CashIn',
      amount: 100,
      description: 'Refuerzo',
      notes: null,
    };

    component.createManualMovement(request);
    expect(cashRegister.createMovement).not.toHaveBeenCalled();

    cashRegister.current.set(makeCashRegisterSession());
    component.submittingMovement.set(true);
    component.createManualMovement(request);
    expect(cashRegister.createMovement).not.toHaveBeenCalled();

    component.submittingMovement.set(false);
    cashRegister.createMovement.mockReturnValue(throwError(() => new Error('movement failed')));
    component.createManualMovement(request);
    expect(component.movementSubmitError()).toContain('No se pudo registrar');
    expect(component.submittingMovement()).toBe(false);
  });

  it('closes the current register, reloads page one, and handles close failures', () => {
    cashRegister.currentLoaded.set(true);
    cashRegister.current.set(makeCashRegisterSession({ id: 'open-session' }));
    create();
    const component = fixture.componentInstance as any;
    const request = { actualCashAmount: 4200, notes: null, reportedTotals: [] };

    component.openCloseDialog();
    component.openMovementDialog();
    expect(component.closeDialogVisible()).toBe(true);
    expect(component.movementDialogVisible()).toBe(true);

    cashRegister.loadHistory.mockClear();
    component.closeCurrent(request);
    expect(cashRegister.close).toHaveBeenCalledWith('open-session', request);
    expect(cashRegister.loadHistory).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(notifications.success).toHaveBeenCalledWith('Caja cerrada.');

    cashRegister.close.mockReturnValue(throwError(() => new Error('close failed')));
    component.closeCurrent(request);
    expect(component.closeSubmitError()).toContain('No se pudo cerrar');

    cashRegister.current.set(null);
    cashRegister.close.mockClear();
    component.closeCurrent(request);
    expect(cashRegister.close).not.toHaveBeenCalled();
  });

  it('handles report failures and calculates lazy history pages with defaults', () => {
    cashRegister.currentLoaded.set(true);
    cashRegister.getById.mockReturnValue(throwError(() => new Error('report failed')));
    create();
    const component = fixture.componentInstance as any;

    component.viewReport('missing-report');
    expect(cashRegister.getById).toHaveBeenCalledWith('missing-report');
    component.hideReport();
    expect(cashRegister.clearSelectedReport).toHaveBeenCalled();
    expect(component.isReportShown('missing-report')).toBe(false);

    cashRegister.loadHistory.mockClear();
    component.onHistoryLazyLoad({ first: 20, rows: 10 });
    component.onHistoryLazyLoad({});
    expect(cashRegister.loadHistory).toHaveBeenNthCalledWith(1, { page: 3, pageSize: 10 });
    expect(cashRegister.loadHistory).toHaveBeenNthCalledWith(2, { page: 1, pageSize: 10 });
  });

  it('covers formatting, statuses, movement types, and all variance tones', () => {
    cashRegister.currentLoaded.set(true);
    create();
    const component = fixture.componentInstance as any;
    const session = makeCashRegisterSession({ expectedCashAmount: null, openingCashAmount: 500 });

    expect(component.expectedCash(session)).toBe(500);
    expect(component.formatSignedCurrency(10)).toContain('+');
    expect(component.formatSignedCurrency(-10)).toContain('-');
    expect(component.formatSignedCurrency(null)).not.toContain('+');
    expect(component.formatDate(null)).toBe('—');
    expect(component.formatDateTime(undefined)).toBe('—');
    expect(component.statusLabel('Open')).toBe('Abierta');
    expect(component.statusLabel('Closed')).toBe('Cerrada');
    expect(component.statusSeverity('Open')).toBe('success');
    expect(component.statusSeverity('Closed')).toBe('secondary');
    expect(component.movementTypeLabel('CashIn')).toBe('Entrada');
    expect(component.movementTypeLabel('CashOut')).toBe('Salida');
    expect(component.movementSeverity('CashIn')).toBe('success');
    expect(component.movementSeverity('CashOut')).toBe('danger');
    expect(component.varianceClass(5)).toContain('emerald');
    expect(component.varianceClass(-5)).toContain('red');
    expect(component.varianceClass(0)).toContain('surface');
    expect(component.varianceIcon(5)).toBeTruthy();
    expect(component.varianceIcon(-5)).toBeTruthy();
    expect(component.varianceIcon(null)).toBeTruthy();
  });
});

describe('CashRegisterCloseDialogComponent', () => {
  let fixture: ComponentFixture<CashRegisterCloseDialogComponent>;
  let component: CashRegisterCloseDialogComponent;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CashRegisterCloseDialogComponent],
      providers: [
        providePrimeNG({
          theme: {
            preset: DEFAULT_PRESET,
          },
        }),
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(CashRegisterCloseDialogComponent);
    component = fixture.componentInstance;
  });

  it('prefills one reported total per system row and emits the close request', () => {
    const session = makeCashRegisterSession();
    const emitted = vi.fn();
    component.closeRegister.subscribe(emitted);

    fixture.componentRef.setInput('session', session);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const form = (component as any).form;
    expect(form.controls.reportedTotals.length).toBe(session.reconciliationLines.length);

    form.controls.actualCashAmount.setValue(4300);
    form.controls.reportedTotals.at(0).controls.reportedAmount.setValue(3300);

    (component as any).submit();

    expect(emitted).toHaveBeenCalledWith({
      actualCashAmount: 4300,
      notes: null,
      reportedTotals: [
        { brandId: 'brand-own', paymentMethod: 'Cash', reportedAmount: 3300 },
        { brandId: 'brand-a', paymentMethod: 'DebitCard', reportedAmount: 1800 },
      ],
    });
  });
});

describe('CashRegisterMovementDialogComponent', () => {
  let fixture: ComponentFixture<CashRegisterMovementDialogComponent>;
  let component: CashRegisterMovementDialogComponent;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CashRegisterMovementDialogComponent],
      providers: [
        providePrimeNG({
          theme: {
            preset: DEFAULT_PRESET,
          },
        }),
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(CashRegisterMovementDialogComponent);
    component = fixture.componentInstance;
  });

  it('validates description and amount before emitting', () => {
    const emitted = vi.fn();
    component.createMovement.subscribe(emitted);

    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const form = (component as any).form;
    form.controls.amount.setValue(0);
    form.controls.description.setValue('   ');

    (component as any).submit();

    expect(emitted).not.toHaveBeenCalled();
    expect(form.controls.amount.invalid).toBe(true);
    expect(form.controls.description.invalid).toBe(true);
  });

  it('emits a trimmed movement request', () => {
    const emitted = vi.fn();
    component.createMovement.subscribe(emitted);

    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const form = (component as any).form;
    form.setValue({
      type: 'CashOut',
      amount: 150,
      description: '  Pago distribuidor  ',
      notes: '  Factura D-100  ',
    });

    (component as any).submit();

    expect(emitted).toHaveBeenCalledWith({
      type: 'CashOut',
      amount: 150,
      description: 'Pago distribuidor',
      notes: 'Factura D-100',
    });
  });
});

function cashRegisterServiceMock() {
  const current = signal<CashRegisterSessionResponse | null>(null);
  const currentLoaded = signal(false);
  const currentLoading = signal(false);
  const currentError = signal<string | null>(null);
  const currentAgeDays = signal<number | null>(null);
  const currentAgeText = signal<string | null>(null);
  const hasStaleOpenRegister = signal(false);
  const selectedReport = signal<CashRegisterSessionResponse | null>(null);
  const reportLoading = signal(false);
  const reportError = signal<string | null>(null);
  const historyItems = signal<CashRegisterSessionSummaryResponse[]>([makeCashRegisterSummary()]);
  const historyTotalCount = signal(1);
  const historyPage = signal(1);
  const historyPageSize = signal(10);
  const historyLoading = signal(false);
  const historyError = signal<string | null>(null);

  return {
    current,
    currentLoaded,
    currentLoading,
    currentError,
    currentAgeDays,
    currentAgeText,
    hasStaleOpenRegister,
    selectedReport,
    reportLoading,
    reportError,
    historyItems,
    historyTotalCount,
    historyPage,
    historyPageSize,
    historyLoading,
    historyError,
    loadCurrent: vi.fn(() => of(current())),
    open: vi.fn((session: CashRegisterSessionResponse) => of(session)),
    close: vi.fn(() => of(makeClosedCashRegisterSession())),
    createMovement: vi.fn((_sessionId: string, request: { type: 'CashIn' | 'CashOut' }) => {
      const amount = 150;
      const signedAmount = request.type === 'CashIn' ? amount : -amount;
      const updated = makeCashRegisterSession({
        ...(current() ?? {}),
        manualCashInAmount: request.type === 'CashIn' ? amount : 0,
        manualCashOutAmount: request.type === 'CashOut' ? amount : 0,
        manualCashNetAmount: signedAmount,
        movements: [
          makeCashRegisterMovement({
            type: request.type,
            amount,
            signedAmount,
          }),
        ],
      });
      current.set(updated);
      return of(updated);
    }),
    getById: vi.fn(() => of(makeClosedCashRegisterSession())),
    loadHistory: vi.fn(() => of(paged(historyItems()))),
    clearSelectedReport: vi.fn(() => selectedReport.set(null)),
  };
}
