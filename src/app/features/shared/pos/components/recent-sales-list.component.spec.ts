import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import {
  makeBrand,
  makeSale,
  makeSaleSearch,
  paged,
} from '../../../../../testing/builders';
import { primeNgTestProviders } from '../../../../../testing/primeng-test-providers';
import { BrandsService } from '../../../../core/brands/brands.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { SalesService } from '../../../../core/sales/sales.service';
import { RecentSalesListComponent } from './recent-sales-list.component';

describe('RecentSalesListComponent', () => {
  let fixture: ComponentFixture<RecentSalesListComponent>;
  let component: RecentSalesListComponent;
  let recentItems: ReturnType<typeof signal<any[]>>;
  let search: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    recentItems = signal([]);
    search = vi.fn(() => of(paged([])));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RecentSalesListComponent],
      providers: [
        ...primeNgTestProviders(),
        {
          provide: SalesService,
          useValue: {
            recentItems: recentItems.asReadonly(),
            recentTotal: signal(0).asReadonly(),
            recentLoading: signal(false).asReadonly(),
            search,
            getById: vi.fn(() => of(makeSale())),
            cancel: vi.fn(() => of(undefined)),
          },
        },
        {
          provide: BrandsService,
          useValue: {
            items: signal([
              makeBrand({ id: 'active', name: 'Activa' }),
              makeBrand({ id: 'archived', status: 'Archived' }),
            ]).asReadonly(),
          },
        },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(RecentSalesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads recent sales and lists only active brands', () => {
    expect(search).toHaveBeenCalledWith({
      searchTerm: undefined,
      saleType: undefined,
      brandId: undefined,
      startDate: undefined,
      endDate: undefined,
      page: 1,
      pageSize: 10,
    });
    expect((component as any).brandOptions()).toEqual([
      { label: 'Todas las marcas', value: null },
      { label: 'Activa', value: 'active' },
    ]);
  });

  it('builds filtered pagination requests and refreshes the current query', () => {
    (component as any).saleType.set('Return');
    (component as any).brandId.set('active');
    (component as any).startDate.set('2026-07-01');
    (component as any).endDate.set('2026-07-27');
    fixture.detectChanges();
    search.mockClear();

    (component as any).onLazyLoad({ first: 50, rows: 50 });

    expect(search).toHaveBeenLastCalledWith({
      searchTerm: undefined,
      saleType: 'Return',
      brandId: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-27',
      page: 2,
      pageSize: 50,
    });

    component.refresh();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('includes the normalized debounced term in backend queries', () => {
    search.mockClear();
    (component as any).debouncedSearch = () => 'TCK-123';
    component.refresh();

    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ searchTerm: 'TCK-123', page: 1 }),
    );
  });

  it('clears all filters and immediately refetches even after search-only input', () => {
    (component as any).searchTerm.set('ticket');
    (component as any).saleType.set('Sale');
    (component as any).brandId.set('active');
    (component as any).startDate.set('2026-07-01');
    (component as any).endDate.set('2026-07-27');
    search.mockClear();

    (component as any).clearFilters();

    expect((component as any).searchTerm()).toBe('');
    expect((component as any).saleType()).toBeNull();
    expect((component as any).brandId()).toBeNull();
    expect((component as any).startDate()).toBe('');
    expect((component as any).endDate()).toBe('');
    expect((component as any).page()).toBe(1);
    expect(search).toHaveBeenCalled();

    (component as any).searchTerm.set('again');
    (component as any).clearSearchTerm();
    expect((component as any).searchTerm()).toBe('');
  });

  it('swallows search errors after the global interceptor handles them', () => {
    search.mockReturnValueOnce(throwError(() => new Error('network')));

    expect(() => component.refresh()).not.toThrow();
  });

  it('renders sale, return, brand and fallback row variants', () => {
    recentItems.set([
      makeSaleSearch({
        id: 'sale',
        ticketId: 'TCK-SALE',
        type: 'Sale',
        paymentMethod: 'CreditCard',
        cardBrand: 'Visa',
        totalAmount: 3500,
      }),
      makeSaleSearch({
        id: 'return',
        ticketId: null,
        type: 'Return',
        totalAmount: -500,
        sellerName: null,
        brands: [],
      }),
    ]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('TCK-SALE');
    expect(text).toContain('Crédito');
    expect(text).toContain('Visa');
    expect(text).toContain('Devolución');
    expect(text).toContain('3.500');
    expect(text).toContain('500');
  });

  it('opens detail and forwards sale-change and return events', () => {
    const row = makeSaleSearch({ id: 'sale-id' });
    const changed = vi.fn();
    const returned = vi.fn();
    component.saleChanged.subscribe(changed);
    component.returnRequested.subscribe(returned);

    (component as any).openDetail(row);
    expect((component as any).selectedSaleId()).toBe('sale-id');
    expect((component as any).detailVisible()).toBe(true);

    (component as any).onDetailSaleChanged('sale-id');
    (component as any).onDetailReturnRequested('sale-id');
    expect(changed).toHaveBeenCalledWith('sale-id');
    expect(returned).toHaveBeenCalledWith('sale-id');
    expect((component as any).detailVisible()).toBe(false);
  });

  it('delegates date, payment, status and currency presentation helpers', () => {
    const sale = makeSaleSearch({ type: 'Sale', status: 'Completed' });
    const returned = makeSaleSearch({ type: 'Return', status: 'Completed' });

    expect((component as any).fullDate('2026-07-27T12:30:00Z')).toBeTruthy();
    expect((component as any).dayLabel('2020-01-01T00:00:00Z')).toBeNull();
    expect((component as any).formatTime('2026-07-27T12:30:00Z')).toMatch(/\d{2}:\d{2}/);
    expect((component as any).paymentIcon('Cash')).toBeTruthy();
    expect((component as any).paymentLabel('Transfer')).toBe('Transferencia');
    expect((component as any).cardBrand('MasterCard')).toBe('Mastercard');
    expect((component as any).typeStatusLabel(sale)).toBe('Venta · Completado');
    expect((component as any).typeStatusSeverity(sale)).toBe('success');
    expect((component as any).typeStatusLabel(returned)).toBe('Devolución · Completado');
    expect((component as any).formatCurrency(1234)).toContain('1.234');
  });
});
