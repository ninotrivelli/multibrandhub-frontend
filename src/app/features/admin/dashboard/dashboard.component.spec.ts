import { WritableSignal, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import {
  makeAuthUser,
  makeCashRegisterSession,
  makeSalesDashboard,
  makeSalesSummary,
  makeStoreTask,
} from '../../../../testing/builders';
import { AuthService } from '../../../core/auth/auth.service';
import { CashRegisterService } from '../../../core/cash-register/cash-register.service';
import { CashRegisterSessionResponse } from '../../../core/cash-register/cash-register.types';
import { NotificationService } from '../../../core/notifications/notification.service';
import { SalesService } from '../../../core/sales/sales.service';
import { TasksService } from '../../../core/tasks/tasks.service';
import { ProductsService } from '../../shared/inventory/products.service';
import { AdminDashboardComponent } from './dashboard.component';

describe('AdminDashboardComponent', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let cash: WritableSignal<CashRegisterSessionResponse | null>;
  let cashAgeText: WritableSignal<string | null>;
  let hasStaleOpenRegister: WritableSignal<boolean>;
  let sales: {
    getSummary: ReturnType<typeof vi.fn>;
    getDashboard: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();

    const user = signal(makeAuthUser({ fullName: 'Admin Local' }));
    const kpiCounts = signal({ total: 3, critical: 1, outOfStock: 1 });
    const kpiLoading = signal(false);
    const immobilizedCount = signal(2);
    const immobilizedLoading = signal(false);
    cash = signal(makeCashRegisterSession());
    const cashLoaded = signal(true);
    const cashLoading = signal(false);
    cashAgeText = signal<string | null>('hoy');
    hasStaleOpenRegister = signal(false);
    const generalPendingTasks = signal([
      makeStoreTask({ id: 'task-high', description: 'Reponer bolsas', priority: 'High' }),
    ]);
    const personalPendingTasks = signal([
      makeStoreTask({
        id: 'task-personal',
        description: 'Revisar pagos de proveedores',
        priority: 'Medium',
        scope: 'Personal',
      }),
    ]);
    const tasksLoading = signal(false);

    sales = {
      getSummary: vi.fn(() => of(makeSalesSummary({ netSalesAmount: 3200 }))),
      getDashboard: vi.fn(() =>
        of(
          makeSalesDashboard({
            kpis: {
              ...makeSalesDashboard().kpis,
              netSalesAmount: 12800,
              averageGrossTicketAmount: 2400,
            },
          }),
        ),
      ),
    };

    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: user.asReadonly() } },
        { provide: SalesService, useValue: sales },
        {
          provide: ProductsService,
          useValue: {
            kpiCounts: kpiCounts.asReadonly(),
            kpiLoading: kpiLoading.asReadonly(),
            immobilizedCount: immobilizedCount.asReadonly(),
            immobilizedLoading: immobilizedLoading.asReadonly(),
            loadKpiCounts: vi.fn(() => of(kpiCounts())),
            loadImmobilizedCount: vi.fn(() => of(immobilizedCount())),
          },
        },
        {
          provide: CashRegisterService,
          useValue: {
            current: cash.asReadonly(),
            currentLoaded: cashLoaded.asReadonly(),
            currentLoading: cashLoading.asReadonly(),
            currentAgeText: cashAgeText.asReadonly(),
            hasStaleOpenRegister: hasStaleOpenRegister.asReadonly(),
            loadCurrent: vi.fn(() => of(cash())),
          },
        },
        {
          provide: TasksService,
          useValue: {
            generalPending: generalPendingTasks.asReadonly(),
            personalPending: personalPendingTasks.asReadonly(),
            pending: computed(() => [...generalPendingTasks(), ...personalPendingTasks()]),
            loading: tasksLoading.asReadonly(),
            loadPending: vi.fn(() => of([])),
            complete: vi.fn((id: string) => {
              generalPendingTasks.update((tasks) => tasks.filter((task) => task.id !== id));
              personalPendingTasks.update((tasks) => tasks.filter((task) => task.id !== id));
              return of(void 0);
            }),
          },
        },
        { provide: NotificationService, useValue: { success: vi.fn() } },
      ],
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(AdminDashboardComponent);
    fixture.detectChanges();
  });

  it('loads the sales summary, dashboard, and renders the operational hub', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(sales.getSummary).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
    );
    expect(sales.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 5 }),
    );
    expect(text).toContain('Ventas de hoy');
    expect(text).toContain('Ventas del mes');
    expect(text).toContain('Ticket promedio');
    expect(text).toContain('Atención requerida');
    expect(text).toContain('Caja');
    expect(text).toContain('Tareas pendientes');
    expect(text).toContain('Tareas del local');
    expect(text).toContain('Tareas personales');
    expect(text).toContain('Reponer bolsas');
    expect(text).not.toContain('Revisar pagos de proveedores');
  });

  it('keeps local and personal pending tasks separated in the dashboard widget', () => {
    let text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Mostrando Tareas del local');
    expect(text).toContain('Reponer bolsas');
    expect(text).not.toContain('Revisar pagos de proveedores');

    const personalTab = fixture.nativeElement.querySelector(
      '[data-testid="admin-dashboard-tasks-personal"]',
    ) as HTMLButtonElement;
    personalTab.click();
    fixture.detectChanges();

    text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Mostrando Tareas personales');
    expect(text).toContain('Revisar pagos de proveedores');
    expect(text).not.toContain('Reponer bolsas');
  });

  it('shows the exact age and a danger alert for an old open register', () => {
    cash.set(makeCashRegisterSession({ openedAtUtc: '2026-07-09T11:00:00Z' }));
    cashAgeText.set('hace 10 días');
    hasStaleOpenRegister.set(true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Caja abierta hace 10 días');
    expect(text).toContain('Cerrala para comenzar una nueva jornada');
  });
});
