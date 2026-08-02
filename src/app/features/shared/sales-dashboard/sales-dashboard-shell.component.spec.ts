import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Signal, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { defer, of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthUser } from '../../../core/auth/auth.types';
import { BrandsService } from '../../../core/brands/brands.service';
import { BrandResponse } from '../../../core/brands/brands.types';
import { NotificationService } from '../../../core/notifications/notification.service';
import { SalesService } from '../../../core/sales/sales.service';
import {
  makeAuthUser,
  makeBrand,
  makeSalesDashboard,
  makeSalesDashboardSale,
  paged,
} from '../../../../testing/builders';
import { primeNgTestProviders } from '../../../../testing/primeng-test-providers';
import { currentMonthRange, defaultWeekStartForRange } from './sales-dashboard.utils';
import { SalesDashboardShellComponent } from './sales-dashboard-shell.component';

describe('SalesDashboardShellComponent', () => {
  let fixture: ComponentFixture<SalesDashboardShellComponent>;
  let user: ReturnType<typeof signal<AuthUser | null>>;
  let sales: { getDashboard: ReturnType<typeof vi.fn>; searchOnce: ReturnType<typeof vi.fn> };
  let routeParamMap: ParamMap;
  let brands: {
    items: Signal<BrandResponse[]>;
    hasItems: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let notifications: { success: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });
    user = signal(makeAuthUser({ role: 'Admin', brandId: 'brand-own' }));
    routeParamMap = convertToParamMap({});
    sales = {
      getDashboard: vi.fn(() => of(makeSalesDashboard())),
      searchOnce: vi.fn(),
    };
    const brandItems = signal([makeBrand({ id: 'brand-own', name: 'Zendra' })]);
    brands = {
      items: brandItems.asReadonly(),
      hasItems: vi.fn(() => true),
      list: vi.fn(() => of(paged([]))),
    };
    notifications = { success: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SalesDashboardShellComponent],
      providers: [
        { provide: AuthService, useValue: { user: user.asReadonly() } },
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return { queryParamMap: routeParamMap };
            },
            queryParamMap: defer(() => of(routeParamMap)),
          },
        },
        { provide: BrandsService, useValue: brands },
        { provide: SalesService, useValue: sales },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    await TestBed.compileComponents();
  });

  function create(variant: 'admin' | 'brand-manager'): SalesDashboardShellComponent {
    fixture = TestBed.createComponent(SalesDashboardShellComponent);
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('loads the Admin dashboard with the current month and all brands by default', () => {
    create('admin');
    const range = currentMonthRange();

    expect(sales.getDashboard).toHaveBeenCalledWith({
      from: range.startDate,
      to: range.endDate,
      brandIds: [],
      chartWeekStart: defaultWeekStartForRange(range.startDate, range.endDate),
      page: 1,
      pageSize: 10,
    });
  });

  it('adds selected Admin brands to the dashboard request', () => {
    const component = create('admin');
    sales.getDashboard.mockClear();

    (component as any).toggleBrand('brand-own');
    TestBed.flushEffects();

    expect(sales.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ brandIds: ['brand-own'] }),
    );
  });

  it('uses the complete selected month range for named month presets', () => {
    const component = create('admin');
    sales.getDashboard.mockClear();

    (component as any).setPeriodPreset('month:2026-05');
    TestBed.flushEffects();

    expect(sales.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-05-01',
        to: '2026-05-31',
      }),
    );
  });

  it('uses date range query params when present', () => {
    routeParamMap = convertToParamMap({ from: '2026-06-05', to: '2026-06-05' });
    create('admin');

    expect(sales.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-06-05',
        to: '2026-06-05',
      }),
    );
  });

  it('forces Brand Manager requests to the user brand', () => {
    user.set(makeAuthUser({ role: 'BrandManager', brandId: 'brand-manager' }));
    create('brand-manager');

    expect(sales.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ brandIds: ['brand-manager'] }),
    );
  });

  it('does not request data for a Brand Manager without an associated brand', () => {
    user.set(makeAuthUser({ role: 'BrandManager', brandId: null }));
    const component = create('brand-manager');
    sales.getDashboard.mockClear();
    sales.searchOnce.mockClear();

    (component as any).retry();

    expect((component as any).currentRequest()).toBeNull();
    expect(sales.getDashboard).not.toHaveBeenCalled();
    expect(sales.searchOnce).not.toHaveBeenCalled();
  });

  it('loads brands on init when needed and tolerates a list failure', () => {
    brands.hasItems.mockReturnValue(false);
    brands.list.mockReturnValue(throwError(() => new Error('brands unavailable')));

    create('admin');

    expect(brands.list).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
  });

  it('normalizes custom dates and ignores empty custom values', () => {
    const component = create('admin') as any;
    sales.getDashboard.mockClear();

    component.setPeriodPreset('custom');
    component.setCustomStartDate('');
    component.setCustomEndDate('');
    expect(sales.getDashboard).not.toHaveBeenCalled();

    component.setCustomStartDate('2026-07-20');
    TestBed.flushEffects();
    expect(component.startDate() <= component.endDate()).toBe(true);

    component.setCustomEndDate('2026-05-01');
    TestBed.flushEffects();
    expect(component.startDate()).toBe('2026-05-01');
    expect(component.endDate()).toBe('2026-07-20');
  });

  it('adds and removes brand filters and can reset all selections', () => {
    const component = create('admin') as any;
    component.toggleBrand('brand-own');
    expect(component.selectedBrandIds()).toEqual(['brand-own']);

    component.toggleBrand('brand-own');
    expect(component.selectedBrandIds()).toEqual([]);

    component.selectedBrandIds.set(['brand-a', 'brand-b']);
    component.page.set(4);
    component.selectAllBrands();
    expect(component.selectedBrandIds()).toEqual([]);
    expect(component.page()).toBe(1);
  });

  it('moves chart weeks only while navigation remains inside the selected range', () => {
    const component = create('admin') as any;
    component.startDate.set('2026-06-01');
    component.endDate.set('2026-06-30');
    component.chartWeekStart.set('2026-06-15');

    component.movePreviousWeek();
    expect(component.chartWeekStart()).toBe('2026-06-08');
    component.moveNextWeek();
    expect(component.chartWeekStart()).toBe('2026-06-15');

    component.chartWeekStart.set(component.weekBounds().minWeekStart);
    component.movePreviousWeek();
    expect(component.chartWeekStart()).toBe(component.weekBounds().minWeekStart);

    component.chartWeekStart.set(component.weekBounds().maxWeekStart);
    component.moveNextWeek();
    expect(component.chartWeekStart()).toBe(component.weekBounds().maxWeekStart);
  });

  it('updates pagination and manages return dialog state', () => {
    const component = create('admin') as any;
    component.onPageChange({ page: 3, pageSize: 25 });
    expect(component.page()).toBe(3);
    expect(component.pageSize()).toBe(25);

    component.openReturnForSale('sale-9');
    expect(component.returnDialogVisible()).toBe(true);
    expect(component.returnPreselectedSaleId()).toBe('sale-9');
    component.onReturnDialogVisibleChange(true);
    expect(component.returnPreselectedSaleId()).toBe('sale-9');
    component.onReturnDialogVisibleChange(false);
    expect(component.returnPreselectedSaleId()).toBeNull();
  });

  it('reports returned sales with and without a ticket and refreshes data', () => {
    const component = create('admin') as any;
    sales.getDashboard.mockClear();

    component.onReturnSaved({ ticketId: 'TICKET-8' });
    expect(notifications.success).toHaveBeenCalledWith(
      'Devolución registrada · Ticket TICKET-8',
      'Devolución ingresada',
    );

    component.onReturnSaved({ ticketId: null });
    expect(notifications.success).toHaveBeenLastCalledWith(
      'Devolución registrada',
      'Devolución ingresada',
    );
    expect(sales.getDashboard).toHaveBeenCalled();
  });

  it('surfaces dashboard request errors and clears the loading flag', () => {
    sales.getDashboard.mockReturnValue(throwError(() => new Error('dashboard unavailable')));
    const component = create('admin') as any;

    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('No se pudo cargar el panel de ventas. Probá de nuevo.');
  });

  it('uses the dashboard paginated sales for multi-brand history', () => {
    const component = create('admin') as any;
    const first = makeSalesDashboardSale({
      id: 'sale-first',
      brands: [{ brandId: 'brand-a', brandName: 'A' }],
    });
    const second = makeSalesDashboardSale({
      id: 'sale-second',
      brands: [{ brandId: 'brand-b', brandName: 'B' }],
    });
    const dashboard = makeSalesDashboard({
      brandIds: ['brand-a', 'brand-b'],
      sales: paged([first, second], { totalCount: 2, page: 1, pageSize: 10 }),
    });
    sales.getDashboard.mockReturnValue(of(dashboard));
    sales.getDashboard.mockClear();
    sales.searchOnce.mockClear();

    component.toggleBrand('brand-a');
    component.toggleBrand('brand-b');
    TestBed.flushEffects();

    expect(sales.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ brandIds: ['brand-a', 'brand-b'], page: 1, pageSize: 10 }),
    );
    expect(component.dashboard().sales).toEqual(dashboard.sales);
    expect(sales.searchOnce).not.toHaveBeenCalled();
  });
});
