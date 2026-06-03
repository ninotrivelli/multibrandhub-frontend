import { TestBed } from '@angular/core/testing';

import { makeProduct } from '../../../../testing/builders';
import { PosCartStore } from './pos-cart.store';

describe('PosCartStore', () => {
  let store: PosCartStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [PosCartStore] });
    store = TestBed.inject(PosCartStore);
  });

  it('adds products and increments quantity on re-add, capped at stock', () => {
    const product = makeProduct({ id: 'p1', price: 1000, currentStock: 2 });

    store.add(product);
    expect(store.itemCount()).toBe(1);
    expect(store.subtotal()).toBe(1000);

    store.add(product);
    expect(store.itemCount()).toBe(2);

    // Capped at currentStock (2).
    store.add(product);
    expect(store.itemCount()).toBe(2);
    expect(store.subtotal()).toBe(2000);
  });

  it('ignores products with no stock', () => {
    store.add(makeProduct({ id: 'p0', currentStock: 0 }));
    expect(store.isEmpty()).toBe(true);
  });

  it('increments, decrements (floor 1) and removes lines', () => {
    const product = makeProduct({ id: 'p1', price: 500, currentStock: 5 });
    store.add(product);

    store.increment('p1');
    expect(store.itemCount()).toBe(2);

    store.decrement('p1');
    store.decrement('p1');
    expect(store.itemCount()).toBe(1); // never below 1

    store.remove('p1');
    expect(store.isEmpty()).toBe(true);
  });

  it('applies a percentage discount per unit and nets the totals', () => {
    store.add(makeProduct({ id: 'p1', price: 1000, currentStock: 5 }));
    store.increment('p1'); // qty 2

    store.setLineDiscountType('p1', 'Percentage');
    store.setLineDiscountValue('p1', 10);

    // 10% of 1000 = 100 off per unit, ×2 units.
    expect(store.subtotal()).toBe(2000);
    expect(store.discountTotal()).toBe(200);
    expect(store.total()).toBe(1800);
    expect(store.allLinesValid()).toBe(true);
  });

  it('treats a fixed-amount discount as per unit', () => {
    store.add(makeProduct({ id: 'p1', price: 1000, currentStock: 5 }));
    store.increment('p1'); // qty 2

    store.setLineDiscountType('p1', 'FixedAmount');
    store.setLineDiscountValue('p1', 150); // per unit

    expect(store.discountTotal()).toBe(300); // 150 × 2
    expect(store.total()).toBe(1700);
    expect(store.allLinesValid()).toBe(true);
  });

  it('flags invalid line discounts and blocks submit', () => {
    store.add(makeProduct({ id: 'p1', price: 1000, currentStock: 5 }));

    // Percentage over 100 is invalid.
    store.setLineDiscountType('p1', 'Percentage');
    store.setLineDiscountValue('p1', 150);
    expect(store.allLinesValid()).toBe(false);
    expect(store.canSubmit()).toBe(false);

    // Fixed amount above the unit price is invalid.
    store.setLineDiscountType('p1', 'FixedAmount');
    store.setLineDiscountValue('p1', 2000);
    expect(store.allLinesValid()).toBe(false);
    expect(store.canSubmit()).toBe(false);

    // Back within range -> valid again.
    store.setLineDiscountValue('p1', 200);
    expect(store.allLinesValid()).toBe(true);
    expect(store.canSubmit()).toBe(true);
  });

  it('clears the discount value when switching a line back to no discount', () => {
    store.add(makeProduct({ id: 'p1', price: 1000, currentStock: 5 }));
    store.setLineDiscountType('p1', 'Percentage');
    store.setLineDiscountValue('p1', 10);

    store.setLineDiscountType('p1', 'None');

    const line = store.pricedLines()[0];
    expect(line.discountValue).toBeNull();
    expect(store.discountTotal()).toBe(0);
    expect(store.total()).toBe(1000);
  });

  it('requires a card brand only for card payments', () => {
    store.add(makeProduct({ id: 'p1', currentStock: 5 }));

    store.setPaymentMethod('Cash');
    expect(store.canSubmit()).toBe(true);

    store.setPaymentMethod('CreditCard');
    expect(store.isCardPayment()).toBe(true);
    expect(store.canSubmit()).toBe(false); // no brand yet

    store.setCardBrand('Visa');
    expect(store.canSubmit()).toBe(true);

    // Switching back to a non-card method clears the brand.
    store.setPaymentMethod('Transfer');
    expect(store.cardBrand()).toBeNull();
    expect(store.canSubmit()).toBe(true);
  });

  it('builds a CreateSaleRequest, omitting empty/irrelevant fields', () => {
    const product = makeProduct({ id: 'p1', price: 1000, currentStock: 5 });
    store.add(product);
    store.increment('p1');
    store.setPaymentMethod('Cash');
    store.setObservations('   ');

    expect(store.toCreateRequest()).toEqual({
      paymentMethod: 'Cash',
      cardBrand: null,
      details: [{ productId: 'p1', quantity: 2 }],
      observations: null,
    });
  });

  it('includes card brand, per-line discount and trimmed notes when present', () => {
    store.add(makeProduct({ id: 'p1', price: 1000, currentStock: 5 }));
    store.setPaymentMethod('DebitCard');
    store.setCardBrand('Oca');
    store.setLineDiscountType('p1', 'FixedAmount');
    store.setLineDiscountValue('p1', 150);
    store.setObservations('  Cliente VIP  ');

    expect(store.toCreateRequest()).toEqual({
      paymentMethod: 'DebitCard',
      cardBrand: 'Oca',
      details: [{ productId: 'p1', quantity: 1, discountType: 'FixedAmount', discountValue: 150 }],
      observations: 'Cliente VIP',
    });
  });

  it('clear resets every field', () => {
    store.add(makeProduct({ id: 'p1', currentStock: 5 }));
    store.setPaymentMethod('CreditCard');
    store.setCardBrand('Visa');
    store.setLineDiscountType('p1', 'Percentage');
    store.setLineDiscountValue('p1', 10);
    store.setObservations('algo');

    store.clear();

    expect(store.isEmpty()).toBe(true);
    expect(store.paymentMethod()).toBe('Cash');
    expect(store.cardBrand()).toBeNull();
    expect(store.observations()).toBe('');
  });
});
