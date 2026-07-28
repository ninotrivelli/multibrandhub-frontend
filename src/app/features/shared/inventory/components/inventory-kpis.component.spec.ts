import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { makeProduct } from '../../../../../testing/builders';
import { primeNgTestProviders } from '../../../../../testing/primeng-test-providers';
import { ProductsService } from '../products.service';
import { InventoryKpisComponent } from './inventory-kpis.component';

describe('InventoryKpisComponent', () => {
  let fixture: ComponentFixture<InventoryKpisComponent>;
  let component: InventoryKpisComponent;
  const kpiCounts = signal({ total: 3, critical: 2, outOfStock: 1 });
  const kpiLoading = signal(false);
  const allItems = signal([
    makeProduct({ id: 'one', price: 1000, currentStock: 3 }),
    makeProduct({ id: 'two', price: 2500, currentStock: 2 }),
  ]);
  const allItemsLoading = signal(false);
  const immobilizedCount = signal(2);
  const immobilizedLoading = signal(false);

  beforeEach(async () => {
    kpiCounts.set({ total: 3, critical: 2, outOfStock: 1 });
    kpiLoading.set(false);
    allItems.set([
      makeProduct({ id: 'one', price: 1000, currentStock: 3 }),
      makeProduct({ id: 'two', price: 2500, currentStock: 2 }),
    ]);
    allItemsLoading.set(false);
    immobilizedCount.set(2);
    immobilizedLoading.set(false);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [InventoryKpisComponent],
      providers: [
        ...primeNgTestProviders(),
        {
          provide: ProductsService,
          useValue: {
            kpiCounts: kpiCounts.asReadonly(),
            kpiLoading: kpiLoading.asReadonly(),
            allItems: allItems.asReadonly(),
            allItemsLoading: allItemsLoading.asReadonly(),
            immobilizedCount: immobilizedCount.asReadonly(),
            immobilizedLoading: immobilizedLoading.asReadonly(),
          },
        },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(InventoryKpisComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('variant', 'store');
    fixture.detectChanges();
  });

  it('calculates and renders store-wide unit, immobilized and alert totals', () => {
    expect((component as any).totalUnits()).toBe('5');
    expect((component as any).criticalCount()).toBe(2);
    expect((component as any).outOfStockCount()).toBe(1);
    expect((component as any).alertsCount()).toBe(3);
    expect((component as any).immobilizedTooltip()).toContain('2 artículos');

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Total en Local');
    expect(text).toContain('Stock Inmovilizado');
    expect(text).toContain('Alertas Activas');
    expect(text).toContain('2 críticos');
  });

  it('renders brand KPIs and emits the selected filters', () => {
    const selected = vi.fn();
    component.kpiSelected.subscribe(selected);
    fixture.componentRef.setInput('variant', 'brand');
    fixture.componentRef.setInput('activeKpi', 'alerts');
    fixture.detectChanges();

    expect((component as any).activeSkus()).toBe(3);
    expect((component as any).inventoryValueFormatted()).toContain('8.000');
    expect(fixture.nativeElement.textContent).toContain('Unidades en Local');
    expect(fixture.nativeElement.textContent).toContain('SKUs Activos');
    expect(fixture.nativeElement.textContent).toContain('Valor Inventario');

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    buttons[1].click();
    buttons[2].click();
    expect(selected.mock.calls.map((call) => call[0])).toEqual(['all', 'all', 'alerts']);
  });

  it('covers empty, singular and loading states', () => {
    allItems.set([]);
    kpiCounts.set({ total: 0, critical: 0, outOfStock: 0 });
    immobilizedCount.set(0);
    fixture.detectChanges();

    expect((component as any).totalUnits()).toBe('0');
    expect((component as any).immobilizedTooltip()).toContain('No hay artículos');

    immobilizedCount.set(1);
    expect((component as any).immobilizedTooltip()).toContain('1 artículo');

    kpiLoading.set(true);
    allItemsLoading.set(true);
    immobilizedLoading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('p-skeleton')).toHaveLength(3);
  });
});
