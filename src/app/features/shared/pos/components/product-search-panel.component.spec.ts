import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { makeBrand, makeCategory, makeProduct, paged } from '../../../../../testing/builders';
import { primeNgTestProviders } from '../../../../../testing/primeng-test-providers';
import { BrandsService } from '../../../../core/brands/brands.service';
import { ProductCategoriesService } from '../../../../core/product-categories/product-categories.service';
import { ProductsService } from '../../inventory/products.service';
import { PosCartStore } from '../pos-cart.store';
import { ProductSearchPanelComponent } from './product-search-panel.component';

describe('ProductSearchPanelComponent', () => {
  let fixture: ComponentFixture<ProductSearchPanelComponent>;
  let component: ProductSearchPanelComponent;
  let searchOnce: ReturnType<typeof vi.fn>;
  let cart: PosCartStore;

  beforeEach(async () => {
    searchOnce = vi.fn(() => of(paged([makeProduct()], { totalCount: 1, pageSize: 8 })));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProductSearchPanelComponent],
      providers: [
        ...primeNgTestProviders(),
        PosCartStore,
        { provide: ProductsService, useValue: { searchOnce } },
        {
          provide: BrandsService,
          useValue: {
            items: signal([
              makeBrand({ id: 'active', name: 'Activa' }),
              makeBrand({ id: 'archived', status: 'Archived' }),
            ]).asReadonly(),
          },
        },
        {
          provide: ProductCategoriesService,
          useValue: {
            items: signal([
              makeCategory({ id: 'one', name: 'Tops' }),
              makeCategory({ id: 'two', name: 'Pantalones' }),
            ]).asReadonly(),
          },
        },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(ProductSearchPanelComponent);
    component = fixture.componentInstance;
    cart = TestBed.inject(PosCartStore);
    fixture.detectChanges();
  });

  it('loads the first page and exposes active brand and category filters', () => {
    expect(searchOnce).toHaveBeenCalledWith({
      searchTerm: undefined,
      brandId: undefined,
      categoryId: undefined,
      page: 1,
      pageSize: 8,
    });
    expect((component as any).activeBrands().map((brand: any) => brand.id)).toEqual(['active']);
    expect((component as any).categoryOptions()).toEqual([
      { label: 'Tops', value: 'one' },
      { label: 'Pantalones', value: 'two' },
    ]);
    expect(fixture.nativeElement.textContent).toContain('Buzo Oversize');
    expect(fixture.nativeElement.textContent).toContain('1 productos encontrados');
  });

  it('searches by brand, category and lazy page and can refresh the same query', () => {
    searchOnce.mockClear();
    (component as any).selectBrand('active');
    (component as any).categoryId.set('two');
    fixture.detectChanges();
    searchOnce.mockClear();

    (component as any).onLazyLoad({ first: 16, rows: 16 });
    expect(searchOnce).toHaveBeenLastCalledWith({
      searchTerm: undefined,
      brandId: 'active',
      categoryId: 'two',
      page: 2,
      pageSize: 16,
    });

    component.refresh();
    expect(searchOnce).toHaveBeenCalledTimes(2);
  });

  it('updates local result state and clears loading after backend errors', () => {
    const second = makeProduct({ id: 'second', name: 'Camisa', currentStock: 0 });
    searchOnce.mockReturnValueOnce(of(paged([second], { totalCount: 9 })));
    component.refresh();

    expect((component as any).results()).toEqual([second]);
    expect((component as any).totalCount()).toBe(9);
    expect((component as any).loading()).toBe(false);

    searchOnce.mockReturnValueOnce(throwError(() => new Error('network')));
    component.refresh();
    expect((component as any).loading()).toBe(false);
  });

  it('renders stock variants and adds only available products to the cart', () => {
    const available = makeProduct({ id: 'available', currentStock: 5, minStockAlert: 2 });
    const critical = makeProduct({ id: 'critical', currentStock: 1, minStockAlert: 2 });
    const empty = makeProduct({
      id: 'empty',
      currentStock: 0,
      minStockAlert: 2,
      size: null,
      color: null,
    });
    (component as any).results.set([available, critical, empty]);
    (component as any).totalCount.set(3);
    fixture.detectChanges();

    expect((component as any).isLowStock(available)).toBe(false);
    expect((component as any).isLowStock(critical)).toBe(true);
    expect((component as any).isLowStock(empty)).toBe(false);
    expect((component as any).formatCurrency(1850)).toContain('1.850');
    expect((component as any).formatNumber(1234)).toContain('1.234');

    const addButtons = fixture.nativeElement.querySelectorAll(
      'button[aria-label="Agregar a la venta"]',
    );
    addButtons[0].click();
    addButtons[1].click();
    addButtons[2].click();
    expect(cart.lines().map((line) => line.product.id)).toEqual(['available', 'critical']);
  });

  it('switches chip styling and clears search while restoring input focus', async () => {
    expect((component as any).chipClasses(true)).toContain('bg-primary');
    expect((component as any).chipClasses(false)).toContain('bg-surface-0');

    (component as any).searchTerm.set(' buzo ');
    fixture.detectChanges();
    expect((component as any).hasFilters()).toBe(true);

    (component as any).clearSearchTerm();
    await Promise.resolve();

    expect((component as any).searchTerm()).toBe('');
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('input'));
  });
});
