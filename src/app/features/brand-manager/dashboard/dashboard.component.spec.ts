import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import {
  makeAuthUser,
  makeBrand,
  makeBrandSettlementEstimate,
  makeProduct,
  makeSalesDashboard,
  makeTopSellingProducts,
  paged,
} from '../../../../testing/builders';
import { AuthService } from '../../../core/auth/auth.service';
import { BrandsService } from '../../../core/brands/brands.service';
import { SalesService } from '../../../core/sales/sales.service';
import { SettlementsService } from '../../../core/settlements/settlements.service';
import { ProductsService } from '../../shared/inventory/products.service';
import { BrandManagerDashboardComponent } from './dashboard.component';

describe('BrandManagerDashboardComponent', () => {
  let fixture: ComponentFixture<BrandManagerDashboardComponent>;
  let sales: {
    getDashboard: ReturnType<typeof vi.fn>;
    getTopProducts: ReturnType<typeof vi.fn>;
  };
  let settlements: {
    getByBrand: ReturnType<typeof vi.fn>;
  };
  let user: ReturnType<typeof signal<ReturnType<typeof makeAuthUser> | null>>;
  let brands: ReturnType<typeof signal<ReturnType<typeof makeBrand>[]>>;
  let brandsService: {
    items: ReturnType<typeof signal<ReturnType<typeof makeBrand>[]>>['asReadonly'] extends (
      ...args: never[]
    ) => infer T
      ? T
      : never;
    loading: ReturnType<typeof signal<boolean>>['asReadonly'] extends (
      ...args: never[]
    ) => infer T
      ? T
      : never;
    hasItems: ReturnType<typeof computed<boolean>>;
    list: ReturnType<typeof vi.fn>;
  };
  let products: {
    kpiCounts: ReturnType<typeof signal<{ total: number; critical: number; outOfStock: number }>>[
      'asReadonly'
    ] extends (...args: never[]) => infer T
      ? T
      : never;
    kpiLoading: ReturnType<typeof signal<boolean>>['asReadonly'] extends (
      ...args: never[]
    ) => infer T
      ? T
      : never;
    loadKpiCounts: ReturnType<typeof vi.fn>;
    searchOnce: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-27T15:00:00Z'));
    TestBed.resetTestingModule();

    user = signal(
      makeAuthUser({
        fullName: 'Marca Responsable',
        role: 'BrandManager',
        brandId: 'brand-a',
      }),
    );
    brands = signal([makeBrand({ id: 'brand-a', name: 'Lumina' })]);
    const kpiCounts = signal({ total: 2, critical: 1, outOfStock: 1 });
    const kpiLoading = signal(false);

    sales = {
      getDashboard: vi.fn(() =>
        of(
          makeSalesDashboard({
            brandIds: ['brand-a'],
            kpis: {
              ...makeSalesDashboard().kpis,
              netSalesAmount: 17000,
              netUnits: 12,
              averageNetTicketAmount: 2125,
            },
          }),
        ),
      ),
      getTopProducts: vi.fn(() => of(makeTopSellingProducts())),
    };
    settlements = {
      getByBrand: vi.fn(() => of(makeBrandSettlementEstimate({ amountBrandOwesStore: -250 }))),
    };
    brandsService = {
      items: brands.asReadonly(),
      loading: signal(false).asReadonly(),
      hasItems: computed(() => brands().length > 0),
      list: vi.fn(() => of(paged(brands()))),
    };
    products = {
      kpiCounts: kpiCounts.asReadonly(),
      kpiLoading: kpiLoading.asReadonly(),
      loadKpiCounts: vi.fn(() => of(kpiCounts())),
      searchOnce: vi.fn(() =>
        of(
          paged([
            makeProduct({
              id: 'product-critical',
              name: 'Camisa Serena',
              sku: 'LUM-CAM-002',
              currentStock: 1,
              minStockAlert: 2,
              brandId: 'brand-a',
              brandName: 'Lumina',
            }),
          ]),
        ),
      ),
    };

    TestBed.configureTestingModule({
      imports: [BrandManagerDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: user.asReadonly() } },
        { provide: BrandsService, useValue: brandsService },
        { provide: SalesService, useValue: sales },
        { provide: SettlementsService, useValue: settlements },
        { provide: ProductsService, useValue: products },
      ],
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(BrandManagerDashboardComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the brand overview with KPIs, ranking, settlement, and stock alerts', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(sales.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-06-01',
        to: '2026-06-30',
        brandIds: ['brand-a'],
        page: 1,
        pageSize: 5,
      }),
    );
    expect(sales.getTopProducts).toHaveBeenCalledWith({
      from: '2026-06-01',
      to: '2026-06-30',
      brandId: 'brand-a',
      limit: 10,
    });
    expect(settlements.getByBrand).toHaveBeenCalledWith('brand-a', {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    expect(text).toContain('Mi Resumen');
    expect(text).toContain('Vista rápida de Lumina');
    expect(text).toContain('Ventas del mes');
    expect(text).toContain('Artículos vendidos');
    expect(text).toContain('Balance estimado');
    expect(text).toContain('Top 10 productos');
    expect(text).toContain('Producto estrella');
    expect(text).toContain('Camisa Serena');
    expect(text).toContain('A favor de tu marca');
    expect(text).toContain('Stock a revisar');
  });

  it('reloads top products when selecting the last 3 months range', () => {
    sales.getTopProducts.mockClear();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const lastThreeMonths = buttons.find((button) =>
      button.textContent?.includes('Últimos 3 meses'),
    );
    expect(lastThreeMonths).toBeTruthy();

    lastThreeMonths!.click();
    fixture.detectChanges();

    expect(sales.getTopProducts).toHaveBeenCalledWith({
      from: '2026-04-01',
      to: '2026-06-30',
      brandId: 'brand-a',
      limit: 10,
    });
  });

  it('stops refresh and shows a clear error when the user has no brand scope', () => {
    const component = fixture.componentInstance as any;
    sales.getDashboard.mockClear();
    sales.getTopProducts.mockClear();
    settlements.getByBrand.mockClear();
    products.loadKpiCounts.mockClear();
    user.set(makeAuthUser({ role: 'BrandManager', brandId: null }));

    component.refresh();
    fixture.detectChanges();

    expect(component.missingBrandScope()).toBe(true);
    expect(component.error()).toBe('Tu usuario no tiene una marca asociada.');
    expect(sales.getDashboard).not.toHaveBeenCalled();
    expect(sales.getTopProducts).not.toHaveBeenCalled();
    expect(settlements.getByBrand).not.toHaveBeenCalled();
    expect(products.loadKpiCounts).not.toHaveBeenCalled();
  });

  it('uses every documented fallback when resolving the brand name', () => {
    const component = fixture.componentInstance as any;
    brands.set([]);

    component.settlement.set(
      makeBrandSettlementEstimate({ brandName: 'Nombre desde liquidación' }),
    );
    expect(component.brandName()).toBe('Nombre desde liquidación');

    component.settlement.set(null);
    component.topProducts.set(
      makeTopSellingProducts({
        items: [
          {
            ...makeTopSellingProducts().items[0],
            brandName: 'Nombre desde ranking',
          },
        ],
      }),
    );
    expect(component.brandName()).toBe('Nombre desde ranking');

    component.topProducts.set(null);
    component.dashboard.set(
      makeSalesDashboard({
        brandDistribution: [
          {
            brandId: 'brand-a',
            brandName: 'Nombre desde ventas',
            grossSalesAmount: 100,
            returnsAmount: 0,
            netSalesAmount: 100,
          },
        ],
      }),
    );
    expect(component.brandName()).toBe('Nombre desde ventas');

    component.dashboard.set(null);
    expect(component.brandName()).toBe('tu marca');
  });

  it('represents positive, zero, and unavailable settlement balances', () => {
    const component = fixture.componentInstance as any;

    component.settlement.set(null);
    expect(component.balance()).toEqual(
      expect.objectContaining({ label: 'Sin estimación', severity: 'secondary', amount: 0 }),
    );

    component.settlement.set(makeBrandSettlementEstimate({ amountBrandOwesStore: 1250 }));
    expect(component.balance()).toEqual(
      expect.objectContaining({ label: 'A pagar al local', severity: 'warn', amount: 1250 }),
    );

    component.settlement.set(makeBrandSettlementEstimate({ amountBrandOwesStore: 0 }));
    expect(component.balance()).toEqual(
      expect.objectContaining({ label: 'Sin saldo pendiente', severity: 'success', amount: 0 }),
    );
  });

  it('normalizes custom ranges and supports the six-month preset', () => {
    const component = fixture.componentInstance as any;
    sales.getTopProducts.mockClear();

    component.setRankingPreset('custom');
    component.setCustomStartDate('');
    component.setCustomEndDate('');
    expect(sales.getTopProducts).not.toHaveBeenCalled();

    component.setCustomStartDate('2026-07-20');
    expect(component.rankingPreset()).toBe('custom');
    expect(component.rankingStartDate()).toBe('2026-06-30');
    expect(component.rankingEndDate()).toBe('2026-07-20');

    component.setRankingPreset('last6Months');
    expect(sales.getTopProducts).toHaveBeenLastCalledWith({
      from: '2026-01-01',
      to: '2026-06-30',
      brandId: 'brand-a',
      limit: 10,
    });
  });

  it('covers chart dimensions, balance tones, and stock severities', () => {
    const component = fixture.componentInstance as any;

    component.dashboard.set(null);
    expect(component.weeklyBarHeight(10)).toBe('0.75rem');
    component.dashboard.set(
      makeSalesDashboard({
        dailySales: [
          {
            date: '2026-06-26',
            grossSalesAmount: 100,
            returnsAmount: 0,
            netSalesAmount: 100,
          },
        ],
      }),
    );
    expect(component.weeklyBarHeight(1)).toBe('0.75rem');
    expect(component.weeklyBarHeight(100)).toBe('7.5rem');

    component.topProducts.set(null);
    expect(component.productBarWidth(makeTopSellingProducts().items[0])).toBe('0%');
    component.topProducts.set(makeTopSellingProducts());
    expect(component.productBarWidth({ ...makeTopSellingProducts().items[0], netUnitsSold: 0 })).toBe(
      '8%',
    );

    for (const tone of ['warn', 'info', 'success', 'secondary'] as const) {
      expect(component.balanceClasses(tone)).toEqual(expect.any(String));
      expect(component.balanceSeverity(tone)).toBe(tone);
    }
    expect(component.rankingButtonClasses('currentMonth')).toContain('bg-primary');
    expect(component.rankingButtonClasses('custom')).toContain('hover:border-primary');
    expect(component.stockStatusSeverity(makeProduct({ currentStock: 0 }))).toBe('danger');
    expect(component.stockStatusSeverity(makeProduct({ currentStock: 1 }))).toBe('warn');
  });

  it('clears stale data and surfaces failures from every dashboard request', () => {
    const component = fixture.componentInstance as any;
    brands.set([]);
    brandsService.list.mockReturnValue(throwError(() => new Error('brands unavailable')));
    sales.getDashboard.mockReturnValue(throwError(() => new Error('dashboard unavailable')));
    sales.getTopProducts.mockReturnValue(throwError(() => new Error('ranking unavailable')));
    settlements.getByBrand.mockReturnValue(throwError(() => new Error('settlement unavailable')));
    products.loadKpiCounts.mockReturnValue(throwError(() => new Error('kpis unavailable')));
    products.searchOnce.mockReturnValue(throwError(() => new Error('stock unavailable')));

    component.refresh();

    expect(brandsService.list).toHaveBeenCalled();
    expect(component.dashboard()).toBeNull();
    expect(component.topProducts()).toBeNull();
    expect(component.settlement()).toBeNull();
    expect(component.stockAlerts()).toEqual([]);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('No se pudo cargar el stock a revisar.');
  });
});
