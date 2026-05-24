import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeBrand, makeCategory } from '../../../../../testing/builders';
import { BrandsService } from '../../../../core/brands/brands.service';
import { ProductCategoriesService } from '../product-categories.service';
import { ProductsService } from '../products.service';
import { StockSearchTabComponent } from './stock-search-tab.component';

describe('StockSearchTabComponent', () => {
  let fixture: ComponentFixture<StockSearchTabComponent>;
  let component: StockSearchTabComponent;
  let products: {
    items: WritableSignal<any[]>;
    totalCount: WritableSignal<number>;
    loading: WritableSignal<boolean>;
    immobilizedItems: WritableSignal<any[]>;
    immobilizedTotal: WritableSignal<number>;
    search: ReturnType<typeof vi.fn>;
    searchImmobilized: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    products = {
      items: signal([]),
      totalCount: signal(0),
      loading: signal(false),
      immobilizedItems: signal([]),
      immobilizedTotal: signal(0),
      search: vi.fn(() => of({ items: [], totalCount: 0, page: 1, pageSize: 12 })),
      searchImmobilized: vi.fn(() => of({ items: [], totalCount: 0, page: 1, pageSize: 12 })),
    };

    TestBed.configureTestingModule({
      imports: [StockSearchTabComponent],
      providers: [
        { provide: ProductsService, useValue: products },
        { provide: BrandsService, useValue: { items: signal([makeBrand()]).asReadonly() } },
        {
          provide: ProductCategoriesService,
          useValue: { items: signal([makeCategory()]).asReadonly() },
        },
      ],
    });
    TestBed.overrideComponent(StockSearchTabComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(StockSearchTabComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('canSeeArchived', true);
    fixture.detectChanges();
    products.search.mockClear();
    products.searchImmobilized.mockClear();
  });

  it('builds normal search params from filters and gates archived results by permission', () => {
    (component as any).searchTerm.set('buzo');
    (component as any).brandId.set('brand-own');
    (component as any).categoryId.set('cat-tops');
    (component as any).stockStatus.set('Critical');
    (component as any).colorFilter.set(' negro ');
    (component as any).sizeFilter.set(' M ');
    (component as any).includeArchived.set(true);
    (component as any).createdAtSort.set('desc');
    (component as any).page.set(2);
    (component as any).pageSize.set(25);

    (component as any).buildRequest();

    expect(products.search).toHaveBeenCalledWith({
      page: 2,
      pageSize: 25,
      searchTerm: 'buzo',
      categoryId: 'cat-tops',
      color: 'negro',
      size: 'M',
      includeInactive: true,
      sortBy: 'createdAt',
      sortDirection: 'desc',
      stockStatus: 'Critical',
      brandId: 'brand-own',
    });
  });

  it('uses KPI alert and immobilized endpoints with the correct scope', () => {
    fixture.componentRef.setInput('kpiFilter', 'alerts');
    fixture.componentRef.setInput('brandScope', 'brand-manager');
    fixture.detectChanges();
    products.search.mockClear();

    (component as any).stockStatus.set('InStock');
    (component as any).buildRequest();

    expect(products.search).toHaveBeenCalledWith(
      expect.objectContaining({
        stockStatuses: ['Critical', 'OutOfStock'],
        brandId: 'brand-manager',
      }),
    );
    expect(products.search.mock.calls[0][0].stockStatus).toBeUndefined();

    fixture.componentRef.setInput('kpiFilter', 'immobilized');
    fixture.detectChanges();
    products.searchImmobilized.mockClear();

    (component as any).page.set(3);
    (component as any).pageSize.set(12);
    (component as any).buildRequest();

    expect(products.searchImmobilized).toHaveBeenCalledWith({
      days: 60,
      page: 3,
      pageSize: 12,
      brandId: 'brand-manager',
    });
  });
});
