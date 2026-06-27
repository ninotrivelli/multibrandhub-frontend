import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

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

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-27T15:00:00Z'));
    TestBed.resetTestingModule();

    const user = signal(
      makeAuthUser({
        fullName: 'Marca Responsable',
        role: 'BrandManager',
        brandId: 'brand-a',
      }),
    );
    const brands = signal([makeBrand({ id: 'brand-a', name: 'Lumina' })]);
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

    TestBed.configureTestingModule({
      imports: [BrandManagerDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: user.asReadonly() } },
        {
          provide: BrandsService,
          useValue: {
            items: brands.asReadonly(),
            loading: signal(false).asReadonly(),
            hasItems: computed(() => brands().length > 0),
            list: vi.fn(() => of(paged(brands()))),
          },
        },
        { provide: SalesService, useValue: sales },
        { provide: SettlementsService, useValue: settlements },
        {
          provide: ProductsService,
          useValue: {
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
          },
        },
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
});
