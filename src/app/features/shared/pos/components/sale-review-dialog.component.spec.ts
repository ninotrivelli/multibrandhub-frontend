import { ComponentFixture, TestBed } from '@angular/core/testing';

import { makeProduct } from '../../../../../testing/builders';
import { PosCartStore } from '../pos-cart.store';
import { SaleReviewDialogComponent } from './sale-review-dialog.component';

describe('SaleReviewDialogComponent', () => {
  let fixture: ComponentFixture<SaleReviewDialogComponent>;
  let component: SaleReviewDialogComponent;
  let cart: PosCartStore;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SaleReviewDialogComponent],
      providers: [PosCartStore],
    });
    TestBed.overrideComponent(SaleReviewDialogComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(SaleReviewDialogComponent);
    component = fixture.componentInstance;
    cart = TestBed.inject(PosCartStore);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('submitting', false);
    fixture.detectChanges();
  });

  it('emits confirm only when the cart can submit and the dialog is not submitting', () => {
    const confirmed = vi.fn();
    const subscription = component.confirm.subscribe(confirmed);

    (component as any).confirmSale();
    expect(confirmed).not.toHaveBeenCalled();

    cart.add(makeProduct({ id: 'p1', currentStock: 5 }));
    (component as any).confirmSale();
    expect(confirmed).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('submitting', true);
    fixture.detectChanges();
    (component as any).confirmSale();
    expect(confirmed).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
  });

  it('keeps the dialog open while submitting', () => {
    const visibleChanged = vi.fn();
    const subscription = component.visibleChange.subscribe(visibleChanged);

    fixture.componentRef.setInput('submitting', true);
    fixture.detectChanges();

    (component as any).onVisibleChange(false);
    (component as any).close();

    expect(visibleChanged).not.toHaveBeenCalled();

    fixture.componentRef.setInput('submitting', false);
    fixture.detectChanges();

    (component as any).close();
    expect(visibleChanged).toHaveBeenCalledWith(false);

    subscription.unsubscribe();
  });
});
