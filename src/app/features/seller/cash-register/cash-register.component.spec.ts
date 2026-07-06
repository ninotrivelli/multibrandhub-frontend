import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { of } from 'rxjs';

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

  beforeEach(async () => {
    TestBed.resetTestingModule();
    cashRegister = cashRegisterServiceMock();

    TestBed.configureTestingModule({
      imports: [SellerCashRegisterComponent],
      providers: [
        { provide: CashRegisterService, useValue: cashRegister },
        { provide: NotificationService, useValue: notificationServiceMock() },
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
