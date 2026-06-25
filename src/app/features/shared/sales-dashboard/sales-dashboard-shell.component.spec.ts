import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Signal, signal } from '@angular/core';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthUser } from '../../../core/auth/auth.types';
import { BrandsService } from '../../../core/brands/brands.service';
import { BrandResponse } from '../../../core/brands/brands.types';
import { NotificationService } from '../../../core/notifications/notification.service';
import { SalesService } from '../../../core/sales/sales.service';
import {
  makeAuthUser,
  makeBrand,
  makeSaleSearch,
  makeSalesDashboard,
  paged,
} from '../../../../testing/builders';
import { currentMonthRange, defaultWeekStartForRange } from './sales-dashboard.utils';
import { SalesDashboardShellComponent } from './sales-dashboard-shell.component';

describe('SalesDashboardShellComponent', () => {
  let fixture: ComponentFixture<SalesDashboardShellComponent>;
  let user: ReturnType<typeof signal<AuthUser | null>>;
  let sales: { getDashboard: ReturnType<typeof vi.fn>; searchOnce: ReturnType<typeof vi.fn> };
  let brands: {
    items: Signal<BrandResponse[]>;
    hasItems: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    user = signal(makeAuthUser({ role: 'Admin', brandId: 'brand-own' }));
    sales = {
      getDashboard: vi.fn(() => of(makeSalesDashboard())),
      searchOnce: vi.fn(() => of(paged([makeSaleSearch()]))),
    };
    const brandItems = signal([makeBrand({ id: 'brand-own', name: 'Zendra' })]);
    brands = {
      items: brandItems.asReadonly(),
      hasItems: vi.fn(() => true),
      list: vi.fn(() => of(paged([]))),
    };

    TestBed.configureTestingModule({
      imports: [SalesDashboardShellComponent],
      providers: [
        { provide: AuthService, useValue: { user: user.asReadonly() } },
        { provide: BrandsService, useValue: brands },
        { provide: SalesService, useValue: sales },
        { provide: NotificationService, useValue: { success: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(SalesDashboardShellComponent, { set: { template: '' } });
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

  it('forces Brand Manager requests to the user brand', () => {
    user.set(makeAuthUser({ role: 'BrandManager', brandId: 'brand-manager' }));
    create('brand-manager');

    expect(sales.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ brandIds: ['brand-manager'] }),
    );
  });
});
