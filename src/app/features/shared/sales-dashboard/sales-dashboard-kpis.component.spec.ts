import { ComponentFixture, TestBed } from '@angular/core/testing';

import { makeSalesDashboard } from '../../../../testing/builders';
import { SalesDashboardKpisComponent } from './sales-dashboard-kpis.component';

describe('SalesDashboardKpisComponent', () => {
  let fixture: ComponentFixture<SalesDashboardKpisComponent>;
  let component: SalesDashboardKpisComponent;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [SalesDashboardKpisComponent] });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(SalesDashboardKpisComponent);
    component = fixture.componentInstance;
  });

  it('renders all commercial KPI values', () => {
    fixture.componentRef.setInput('kpis', makeSalesDashboard().kpis);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Total vendido');
    expect(text).toContain('4.500');
    expect(text).toContain('Tickets involucrados');
    expect(text).toContain('Artículos vendidos');
    expect(text).toContain('Ticket promedio');
    expect((component as any).formatCurrency(1234)).toContain('1.234');
    expect((component as any).formatNumber(1234)).toContain('1.234');
  });

  it('uses zero fallbacks when KPIs are absent', () => {
    fixture.componentRef.setInput('kpis', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('$');
    expect(fixture.nativeElement.querySelectorAll('p-skeleton')).toHaveLength(0);
  });

  it('renders one skeleton per card while loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('p-skeleton')).toHaveLength(4);
  });
});
