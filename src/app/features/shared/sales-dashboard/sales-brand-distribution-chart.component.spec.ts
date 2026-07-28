import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesBrandDistributionChartComponent } from './sales-brand-distribution-chart.component';

describe('SalesBrandDistributionChartComponent', () => {
  let fixture: ComponentFixture<SalesBrandDistributionChartComponent>;
  let component: SalesBrandDistributionChartComponent;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [SalesBrandDistributionChartComponent] });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(SalesBrandDistributionChartComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('startDate', '2026-07-01');
    fixture.componentRef.setInput('endDate', '2026-07-31');
    fixture.componentRef.setInput('distribution', [
      {
        brandId: 'one',
        brandName: 'Zendra',
        grossSalesAmount: 3000,
        returnsAmount: 500,
        netSalesAmount: 2500,
      },
      {
        brandId: 'two',
        brandName: 'Lumina',
        grossSalesAmount: 2000,
        returnsAmount: 0,
        netSalesAmount: 2000,
      },
    ]);
    fixture.detectChanges();
  });

  it('calculates totals, range copy and doughnut datasets', () => {
    expect((component as any).totalGross()).toBe(5000);
    expect((component as any).rangeLabel()).toContain('julio');
    expect((component as any).formatCurrency(5000)).toContain('5.000');

    const data = (component as any).chartData();
    expect(data.labels).toEqual(['Zendra', 'Lumina']);
    expect(data.datasets[0].data).toEqual([3000, 2000]);
    expect(data.datasets[0].backgroundColor).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Total bruto');
  });

  it('formats every supported tooltip payload shape', () => {
    const label = (component as any).chartOptions().plugins.tooltip.callbacks.label;

    expect(label({ label: 'Zendra', parsed: 1500 })).toContain('Zendra:');
    expect(label({ parsed: { y: 1250 } })).toContain('1.250');
    expect(label({ label: '', parsed: null, raw: 900 })).toContain('900');
    expect(label({ parsed: { y: null }, raw: 'unknown' })).toContain('0');
  });

  it('renders single-brand and empty states', () => {
    fixture.componentRef.setInput('distribution', [
      {
        brandId: 'one',
        brandName: 'Zendra',
        grossSalesAmount: 3000,
        returnsAmount: 0,
        netSalesAmount: 3000,
      },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('100%');

    fixture.componentRef.setInput('distribution', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'No hay ventas por marca para este filtro.',
    );
  });

  it('renders the chart loading skeleton', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('p-skeleton')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Total bruto');
  });
});
