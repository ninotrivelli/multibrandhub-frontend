import { ComponentFixture, TestBed } from '@angular/core/testing';

import { primeNgTestProviders } from '../../../../../testing/primeng-test-providers';
import { PosCartStore } from '../pos-cart.store';
import { PaymentMethodSelectorComponent } from './payment-method-selector.component';

describe('PaymentMethodSelectorComponent', () => {
  let fixture: ComponentFixture<PaymentMethodSelectorComponent>;
  let component: PaymentMethodSelectorComponent;
  let cart: PosCartStore;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PaymentMethodSelectorComponent],
      providers: [PosCartStore, ...primeNgTestProviders()],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(PaymentMethodSelectorComponent);
    component = fixture.componentInstance;
    cart = TestBed.inject(PosCartStore);
    fixture.detectChanges();
  });

  it('renders all backend payment methods and card brands', () => {
    expect((component as any).options.map((option: any) => option.value)).toEqual([
      'DebitCard',
      'CreditCard',
      'Transfer',
      'Cash',
    ]);
    expect((component as any).cardBrandOptions.map((option: any) => option.value)).toEqual([
      'Visa',
      'MasterCard',
      'Oca',
      'Other',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Elegí la tarjeta para continuar.');
  });

  it('selects a method and hides card controls for non-card payments', () => {
    (component as any).setCardBrand('Visa');
    (component as any).select('Cash');
    fixture.detectChanges();

    expect(cart.paymentMethod()).toBe('Cash');
    expect(cart.cardBrand()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Marca de tarjeta');
  });

  it('updates the selected card brand', () => {
    (component as any).select('CreditCard');
    (component as any).setCardBrand('Oca');
    fixture.detectChanges();

    expect(cart.isCardPayment()).toBe(true);
    expect(cart.cardBrand()).toBe('Oca');
    expect(fixture.nativeElement.textContent).not.toContain('Elegí la tarjeta para continuar.');
  });
});
