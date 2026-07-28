import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StockStatusTagComponent } from './stock-status-tag.component';

describe('StockStatusTagComponent', () => {
  let fixture: ComponentFixture<StockStatusTagComponent>;
  let component: StockStatusTagComponent;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [StockStatusTagComponent] });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(StockStatusTagComponent);
    component = fixture.componentInstance;
  });

  it.each([
    { stock: 8, min: 2, status: 'OK', severity: 'success' },
    { stock: 2, min: 2, status: 'Crítico', severity: 'warn' },
    { stock: 0, min: 2, status: 'Agotado', severity: 'danger' },
  ])('maps $status inventory status and severity', ({ stock, min, status, severity }) => {
    fixture.componentRef.setInput('stock', stock);
    fixture.componentRef.setInput('minAlert', min);
    fixture.detectChanges();

    expect((component as any).status()).toBe(status);
    expect((component as any).severity()).toBe(severity);
    expect(fixture.nativeElement.textContent).toContain(status);
  });
});
