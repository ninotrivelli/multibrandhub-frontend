import { ComponentFixture, TestBed } from '@angular/core/testing';

import { makeProduct } from '../../../../../testing/builders';
import { PosCartStore } from '../pos-cart.store';
import { CartPanelComponent } from './cart-panel.component';

describe('CartPanelComponent', () => {
  let fixture: ComponentFixture<CartPanelComponent>;
  let component: CartPanelComponent;
  let cart: PosCartStore;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CartPanelComponent],
      providers: [PosCartStore],
    });
    TestBed.overrideComponent(CartPanelComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(CartPanelComponent);
    component = fixture.componentInstance;
    cart = TestBed.inject(PosCartStore);
    fixture.componentRef.setInput('submitting', false);
    fixture.detectChanges();
  });

  it('emits submit only when the ticket is ready and not loading', () => {
    const submitted = vi.fn();
    const subscription = component.submitSale.subscribe(submitted);

    (component as any).onSubmit();
    expect(submitted).not.toHaveBeenCalled();

    cart.add(makeProduct({ id: 'p1', currentStock: 5 }));
    (component as any).onSubmit();
    expect(submitted).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('submitting', true);
    fixture.detectChanges();
    (component as any).onSubmit();
    expect(submitted).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('submitting', false);
    fixture.detectChanges();
    cart.setPaymentMethod('CreditCard');
    (component as any).onSubmit();
    expect(submitted).toHaveBeenCalledTimes(1);

    cart.setCardBrand('Visa');
    (component as any).onSubmit();
    expect(submitted).toHaveBeenCalledTimes(2);

    subscription.unsubscribe();
  });
});
