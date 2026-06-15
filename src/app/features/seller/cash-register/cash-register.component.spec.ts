import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { of } from 'rxjs';

import {
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
    expect(text).toContain('Caja abierta');
    expect(text).toContain('Caja efectivo');
    expect(text).toContain('Recaudación total');
    expect(text).toContain('Cerrar Caja');
    expect(text).toContain('Zendra');
    expect(text).toContain('Lumina');
  });

  it('renders a closed report with variance and reconciliation lines', async () => {
    cashRegister.currentLoaded.set(true);
    cashRegister.current.set(null);
    cashRegister.selectedReport.set(makeClosedCashRegisterSession());

    create();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Reporte de caja');
    expect(text).toContain('Diferencia efectivo');
    expect(text).toContain('Conciliación');
    expect(text).toContain('Lumina');
    expect(text).toContain('+');
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
    getById: vi.fn(() => of(makeClosedCashRegisterSession())),
    loadHistory: vi.fn(() => of(paged(historyItems()))),
  };
}
