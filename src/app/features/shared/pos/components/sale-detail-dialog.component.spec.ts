import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SalesService } from '../../../../core/sales/sales.service';
import { makeSale, makeSaleDetail } from '../../../../../testing/builders';
import { SaleDetailDialogComponent } from './sale-detail-dialog.component';

describe('SaleDetailDialogComponent', () => {
  let fixture: ComponentFixture<SaleDetailDialogComponent>;
  let sales: { getById: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    sales = {
      getById: vi.fn(() =>
        of(
          makeSale({
            details: [
              makeSaleDetail({ id: 'own-line', brandId: 'brand-own', brandName: 'Zendra' }),
              makeSaleDetail({
                id: 'other-line',
                brandId: 'brand-other',
                brandName: 'Lumina',
                productName: 'Top Lumina',
                subTotal: 1200,
              }),
            ],
          }),
        ),
      ),
    };

    TestBed.configureTestingModule({
      imports: [SaleDetailDialogComponent],
      providers: [{ provide: SalesService, useValue: sales }],
    });
    TestBed.overrideComponent(SaleDetailDialogComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(SaleDetailDialogComponent);
  });

  it('groups only the scoped brand lines for Brand Manager detail views', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('saleId', 'sale-1');
    fixture.componentRef.setInput('brandScopeId', 'brand-own');
    fixture.detectChanges();

    const groups = (fixture.componentInstance as any).brandGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0].brandName).toBe('Zendra');
    expect(groups[0].items.map((item: { id: string }) => item.id)).toEqual(['own-line']);
  });
});
