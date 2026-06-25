import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SalesService } from '../../../../core/sales/sales.service';
import { makeSale, paged } from '../../../../../testing/builders';
import { ReturnDialogComponent } from './return-dialog.component';

describe('ReturnDialogComponent', () => {
  let fixture: ComponentFixture<ReturnDialogComponent>;
  let sales: {
    getById: ReturnType<typeof vi.fn>;
    searchOnce: ReturnType<typeof vi.fn>;
    createReturn: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    sales = {
      getById: vi.fn(() => of(makeSale({ id: 'sale-preselected' }))),
      searchOnce: vi.fn(() => of(paged([]))),
      createReturn: vi.fn(() => of(makeSale({ type: 'Return' }))),
    };

    TestBed.configureTestingModule({
      imports: [ReturnDialogComponent],
      providers: [{ provide: SalesService, useValue: sales }],
    });
    TestBed.overrideComponent(ReturnDialogComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(ReturnDialogComponent);
  });

  it('opens directly on the selected sale detail when preselectedSaleId is provided', () => {
    fixture.componentRef.setInput('preselectedSaleId', 'sale-preselected');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    expect(sales.getById).toHaveBeenCalledWith('sale-preselected');
    expect((fixture.componentInstance as any).step()).toBe('detail');
    expect((fixture.componentInstance as any).selectedSale()?.id).toBe('sale-preselected');
  });
});
