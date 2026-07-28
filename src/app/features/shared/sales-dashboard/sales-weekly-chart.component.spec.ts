import { ComponentFixture, TestBed } from '@angular/core/testing';

import { primeNgTestProviders } from '../../../../testing/primeng-test-providers';
import { SalesWeeklyChartComponent } from './sales-weekly-chart.component';

describe('SalesWeeklyChartComponent', () => {
  let fixture: ComponentFixture<SalesWeeklyChartComponent>;
  let component: SalesWeeklyChartComponent;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SalesWeeklyChartComponent],
      providers: primeNgTestProviders(),
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(SalesWeeklyChartComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('weekStart', '2026-07-20');
    fixture.componentRef.setInput('startDate', '2026-07-21');
    fixture.componentRef.setInput('endDate', '2026-07-23');
    fixture.componentRef.setInput('dailySales', [
      {
        date: '2026-07-21',
        grossSalesAmount: 3000,
        returnsAmount: 500,
        netSalesAmount: 2500,
      },
      {
        date: '2026-07-24',
        grossSalesAmount: 9000,
        returnsAmount: 0,
        netSalesAmount: 9000,
      },
    ]);
    fixture.detectChanges();
  });

  it('builds seven rows and zeroes backend values outside the active range', () => {
    const rows = (component as any).rows();

    expect(rows).toHaveLength(7);
    expect(rows[1]).toEqual(
      expect.objectContaining({
        date: '2026-07-21',
        grossSalesAmount: 3000,
        returnsAmount: 500,
        netSalesAmount: 2500,
        inRange: true,
      }),
    );
    expect(rows[4]).toEqual(
      expect.objectContaining({
        date: '2026-07-24',
        grossSalesAmount: 0,
        returnsAmount: 0,
        netSalesAmount: 0,
        inRange: false,
      }),
    );
    expect((component as any).hasMovement()).toBe(true);
    expect((component as any).netSummary()).toContain('2.500');
  });

  it('builds chart datasets and visually mutes out-of-range days', () => {
    document.documentElement.style.setProperty('--p-primary-color', '#123456');
    document.documentElement.style.setProperty('--p-red-500', 'rgb(10, 20, 30)');
    fixture.componentRef.setInput('endDate', '2026-07-22');
    fixture.detectChanges();

    const data = (component as any).chartData();

    expect(data.labels).toHaveLength(7);
    expect(data.datasets[0].data[1]).toBe(3000);
    expect(data.datasets[1].data[1]).toBe(-500);
    expect(data.datasets[0].backgroundColor[1]).toBe('#123456');
    expect(data.datasets[0].backgroundColor[0]).toBe('rgba(18, 52, 86, 0.25)');
    expect(data.datasets[1].backgroundColor[0]).toBe('rgba(10, 20, 30, 0.25)');

    document.documentElement.style.removeProperty('--p-primary-color');
    document.documentElement.style.removeProperty('--p-red-500');
  });

  it('formats tooltip and tick callbacks for in-range and excluded data', () => {
    const options = (component as any).chartOptions();
    const tooltip = options.plugins.tooltip.callbacks.label;
    const tickColor = options.scales.x.ticks.color;

    expect(
      tooltip({ dataIndex: 0, dataset: { label: 'Ventas' }, parsed: { y: 100 } }),
    ).toBe('Ventas: Fuera del filtro aplicado');
    expect(tooltip({ dataIndex: 1, dataset: {}, parsed: { y: null } })).toContain('0');
    expect(tooltip({ dataIndex: 99, dataset: { label: 'Total' }, parsed: {} })).toContain(
      'Total:',
    );
    expect(tickColor({ index: 1 })).toBeTruthy();
    expect(tickColor({ index: 0 })).toBeTruthy();
    expect(tickColor({ index: 99 })).toBe(tickColor({ index: 0 }));
  });

  it('describes full-week, one-day and partial filters', () => {
    expect((component as any).filterRangeLabel()).toContain('Filtro:');
    expect((component as any).weekLabel()).toContain('20 de julio');

    fixture.componentRef.setInput('startDate', '2026-07-20');
    fixture.componentRef.setInput('endDate', '2026-07-26');
    fixture.detectChanges();
    expect((component as any).filterRangeLabel()).toBeNull();

    fixture.componentRef.setInput('startDate', '2026-07-22');
    fixture.componentRef.setInput('endDate', '2026-07-22');
    fixture.detectChanges();
    expect((component as any).filterRangeLabel()).toContain('Filtro: solo');
  });

  it('emits week navigation and renders loading and empty states', () => {
    const previous = vi.fn();
    const next = vi.fn();
    component.previousWeek.subscribe(previous);
    component.nextWeek.subscribe(next);
    fixture.componentRef.setInput('canMovePrevious', true);
    fixture.componentRef.setInput('canMoveNext', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    buttons[1].click();
    expect(previous).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('p-skeleton')).toHaveLength(7);

    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('dailySales', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay movimientos para esta semana.');
  });
});
