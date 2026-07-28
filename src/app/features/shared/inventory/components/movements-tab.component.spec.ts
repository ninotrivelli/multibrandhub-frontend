import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { makeBrand, makeMovement, makeProduct } from '../../../../../testing/builders';
import { primeNgTestProviders } from '../../../../../testing/primeng-test-providers';
import { BrandsService } from '../../../../core/brands/brands.service';
import { ProductsService } from '../products.service';
import { StockMovementsService } from '../stock-movements.service';
import { MovementType } from '../inventory.types';
import { MovementsTabComponent } from './movements-tab.component';

describe('MovementsTabComponent', () => {
  let fixture: ComponentFixture<MovementsTabComponent>;
  let component: MovementsTabComponent;
  let movementItems: WritableSignal<any[]>;
  let refreshTick: WritableSignal<number>;
  let search: ReturnType<typeof vi.fn>;
  let searchOnce: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    movementItems = signal([]);
    refreshTick = signal(0);
    search = vi.fn(() => of({ items: [], totalCount: 0, page: 1, pageSize: 20 }));
    searchOnce = vi.fn(() =>
      of({ items: [makeProduct()], totalCount: 1, page: 1, pageSize: 8 }),
    );

    TestBed.configureTestingModule({
      imports: [MovementsTabComponent],
      providers: [
        ...primeNgTestProviders(),
        {
          provide: ProductsService,
          useValue: { searchOnce },
        },
        {
          provide: StockMovementsService,
          useValue: {
            searchItems: movementItems.asReadonly(),
            searchTotalCount: signal(0).asReadonly(),
            searchLoading: signal(false).asReadonly(),
            refreshTick: refreshTick.asReadonly(),
            search,
          },
        },
        {
          provide: BrandsService,
          useValue: {
            items: signal([
              makeBrand({ id: 'active', name: 'Activa' }),
              makeBrand({ id: 'archived', name: 'Archivada', status: 'Archived' }),
            ]).asReadonly(),
          },
        },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(MovementsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    search.mockClear();
  });

  it('exposes only active brands and adapts the empty table colspan', () => {
    expect((component as any).brandOptions()).toEqual([{ label: 'Activa', value: 'active' }]);
    expect((component as any).emptyColspan()).toBe(7);

    fixture.componentRef.setInput('showBrandFilter', false);
    fixture.detectChanges();

    expect((component as any).emptyColspan()).toBe(6);
    expect(fixture.nativeElement.textContent).not.toContain('Todas las marcas');
  });

  it('selects products and clears every filter', () => {
    const product = makeProduct();

    (component as any).selectProduct(product);
    (component as any).selectedType.set(MovementType.Loss);
    (component as any).selectedBrandId.set('active');
    (component as any).dateFrom.set('2026-06-01');
    (component as any).dateTo.set('2026-06-30');
    (component as any).searchTerm.set('otro');
    fixture.detectChanges();

    expect((component as any).selectedProduct()).toEqual(product);
    expect((component as any).hasAnyFilter()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Buzo Oversize');
    expect(fixture.nativeElement.textContent).toContain('Limpiar filtros');

    (component as any).clearAllFilters();
    fixture.detectChanges();

    expect((component as any).selectedProduct()).toBeNull();
    expect((component as any).selectedType()).toBeNull();
    expect((component as any).selectedBrandId()).toBeNull();
    expect((component as any).dateFrom()).toBe('');
    expect((component as any).dateTo()).toBe('');
    expect((component as any).searchTerm()).toBe('');
    expect((component as any).hasAnyFilter()).toBe(false);
  });

  it('builds a complete movement request and gives brand scope precedence', () => {
    fixture.componentRef.setInput('brandScope', 'manager-brand');
    (component as any).selectedProduct.set(makeProduct({ id: 'selected-product' }));
    (component as any).selectedType.set(MovementType.Adjustment);
    (component as any).selectedBrandId.set('ignored-brand');
    (component as any).dateFrom.set('2026-06-01');
    (component as any).dateTo.set('2026-06-30');
    (component as any).page.set(2);
    (component as any).pageSize.set(50);
    search.mockClear();

    component.refresh();

    expect(search).toHaveBeenCalledWith({
      page: 2,
      pageSize: 50,
      productId: 'selected-product',
      type: MovementType.Adjustment,
      brandId: 'manager-brand',
      from: '2026-06-01',
      to: '2026-06-30',
    });
  });

  it('uses the selected brand and tolerates service errors', () => {
    search.mockReturnValueOnce(throwError(() => new Error('network')));
    (component as any).selectedBrandId.set('selected-brand');
    search.mockClear();

    expect(() => component.refresh()).not.toThrow();
    expect(search).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      brandId: 'selected-brand',
    });
  });

  it('changes pages only when lazy-load pagination actually changes', () => {
    (component as any).onLazyLoad({ first: 0, rows: 20 });
    expect(search).not.toHaveBeenCalled();

    (component as any).onLazyLoad({ first: 50, rows: 50 });
    expect((component as any).page()).toBe(2);
    expect((component as any).pageSize()).toBe(50);
    expect(search).toHaveBeenLastCalledWith({ page: 2, pageSize: 50 });

    search.mockClear();
    (component as any).onLazyLoad({ first: undefined, rows: undefined });
    expect((component as any).page()).toBe(1);
    expect((component as any).pageSize()).toBe(20);
    expect(search).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('refetches when a new movement is signalled by the service', () => {
    refreshTick.set(1);
    fixture.detectChanges();

    expect(search).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('renders positive, negative and neutral movement rows with fallbacks', () => {
    movementItems.set([
      makeMovement({ id: 'in', quantity: 3, type: MovementType.StockIn }),
      makeMovement({
        id: 'loss',
        quantity: -2,
        type: MovementType.Loss,
        productName: null,
        brandName: null,
        userFullName: null,
        observations: null,
      }),
      makeMovement({
        id: 'price',
        quantity: 0,
        type: MovementType.PriceChange,
        observations: 'Precio anterior: $100',
      }),
    ]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ingreso');
    expect(text).toContain('Egreso');
    expect(text).toContain('Cambio de precio');
    expect(text).toContain('+3');
    expect(text).toContain('-2');
    expect(text).toContain('Sistema');
    expect(text).toContain('Precio anterior: $100');
  });

  it('delegates movement labels, severities and date formatting to inventory utilities', () => {
    const stockIn = makeMovement({ type: MovementType.StockIn });
    const sale = makeMovement({ type: MovementType.Sale });
    const returned = makeMovement({ type: MovementType.Return });
    const adjustment = makeMovement({ type: MovementType.Adjustment });
    const loss = makeMovement({ type: MovementType.Loss });
    const price = makeMovement({ type: MovementType.PriceChange });

    expect((component as any).typeLabel(stockIn)).toBe('Ingreso');
    expect((component as any).typeSeverity(stockIn)).toBe('success');
    expect((component as any).typeSeverity(sale)).toBe('info');
    expect((component as any).typeSeverity(returned)).toBe('warn');
    expect((component as any).typeSeverity(adjustment)).toBe('warn');
    expect((component as any).typeSeverity(loss)).toBe('danger');
    expect((component as any).typeSeverity(price)).toBe('secondary');
    expect((component as any).formatDate('2026-05-01T12:00:00Z')).toMatch(/01\/05\/2026/);
  });

  it('clears a selected product and the active search term', async () => {
    (component as any).selectProduct(makeProduct());
    (component as any).clearProduct();
    expect((component as any).selectedProduct()).toBeNull();

    (component as any).searchTerm.set('buzo');
    fixture.detectChanges();
    (component as any).clearSearchTerm();
    await Promise.resolve();

    expect((component as any).searchTerm()).toBe('');
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('input[placeholder*="Buscar"]'),
    );
  });
});
