import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesDashboardListComponent } from './sales-dashboard-list.component';
import { makeSalesDashboardSale, paged } from '../../../../testing/builders';

describe('SalesDashboardListComponent', () => {
  let fixture: ComponentFixture<SalesDashboardListComponent>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [SalesDashboardListComponent] });
    TestBed.overrideComponent(SalesDashboardListComponent, { set: { template: '' } });
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
});
