import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesDashboardListComponent } from './sales-dashboard-list.component';
import { makeSalesDashboardSale, paged } from '../../../../testing/builders';
import { primeNgTestProviders } from '../../../../testing/primeng-test-providers';

describe('SalesDashboardListComponent', () => {
  let fixture: ComponentFixture<SalesDashboardListComponent>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });
    TestBed.configureTestingModule({ imports: [SalesDashboardListComponent] });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(SalesDashboardListComponent);
    fixture.componentRef.setInput('startDate', '2026-06-01');
    fixture.componentRef.setInput('endDate', '2026-06-05');
  });

  it('opens the sale detail when a row is selected', () => {
    const row = makeSalesDashboardSale({ id: 'sale-clicked' });
    fixture.componentRef.setInput('sales', paged([row]));
    fixture.detectChanges();

    (fixture.componentInstance as any).openDetail(row);

    expect((fixture.componentInstance as any).selectedSaleId()).toBe('sale-clicked');
    expect((fixture.componentInstance as any).detailVisible()).toBe(true);
  });

  it('closes detail and emits the selected sale id when a return is requested', () => {
    const spy = vi.fn();
    fixture.componentInstance.returnRequested.subscribe(spy);
    (fixture.componentInstance as any).detailVisible.set(true);

    (fixture.componentInstance as any).onDetailReturnRequested('sale-return');

    expect((fixture.componentInstance as any).detailVisible()).toBe(false);
    expect(spy).toHaveBeenCalledWith('sale-return');
  });

  it('emits saleChanged when the detail reports a mutation', () => {
    const spy = vi.fn();
    fixture.componentInstance.saleChanged.subscribe(spy);

    (fixture.componentInstance as any).onDetailSaleChanged('sale-canceled');

    expect(spy).toHaveBeenCalledWith('sale-canceled');
  });
});
