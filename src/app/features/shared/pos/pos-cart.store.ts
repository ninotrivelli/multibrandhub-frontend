import { Injectable, computed, signal } from '@angular/core';

import { ProductResponse } from '../inventory/inventory.types';
import {
  CardBrand,
  CreateSaleDetailRequest,
  CreateSaleRequest,
  PaymentMethod,
  SaleDetailDiscountType,
} from '../../../core/sales/sales.types';

export interface CartLine {
  product: ProductResponse;
  quantity: number;
  // Per-line discount. 'None' means no discount and discountValue is null.
  discountType: SaleDetailDiscountType;
  discountValue: number | null;
}

// A cart line with its money already resolved (mirrors the backend pricing), so
// the template renders net figures without recomputing per cell.
export interface PricedCartLine extends CartLine {
  unitDiscount: number;
  unitNet: number;
  lineSubtotal: number;
  valid: boolean;
}

export interface CartBrandGroup {
  brandId: string;
  brandName: string;
  itemCount: number;
  lines: PricedCartLine[];
  total: number;
}

const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'DebitCard';

// Screen-scoped state for the POS sale being built. Provided at the
// `pos-shell` level (NOT providedIn: 'root') so the search panel and the cart
// panel share one instance without prop-drilling, while staying local to the
// POS screen. Holds only UI/view state — all money is recomputed server-side;
// the figures here just preview what the backend will charge.
@Injectable()
export class PosCartStore {
  private readonly _lines = signal<CartLine[]>([]);
  private readonly _paymentMethod = signal<PaymentMethod>(DEFAULT_PAYMENT_METHOD);
  private readonly _cardBrand = signal<CardBrand | null>(null);
  private readonly _observations = signal('');

  readonly lines = this._lines.asReadonly();
  readonly paymentMethod = this._paymentMethod.asReadonly();
  readonly cardBrand = this._cardBrand.asReadonly();
  readonly observations = this._observations.asReadonly();

  readonly isEmpty = computed(() => this._lines().length === 0);
  readonly itemCount = computed(() => this._lines().reduce((sum, l) => sum + l.quantity, 0));

  // Each line with its discount math resolved the same way the backend does.
  // Every intermediate figure is rounded to 2 decimals so binary floating
  // point dust (e.g. 9.09 * 3 = 27.269999...) never reaches the templates or
  // drifts from the backend's decimal arithmetic.
  readonly pricedLines = computed<PricedCartLine[]>(() =>
    this._lines().map((line) => {
      const unitDiscount = lineUnitDiscount(line);
      const unitNet = round2(line.product.price - unitDiscount);
      return {
        ...line,
        unitDiscount,
        unitNet,
        lineSubtotal: round2(unitNet * line.quantity),
        valid: isLineDiscountValid(line),
      };
    }),
  );

  // Gross (pre-discount) subtotal.
  readonly subtotal = computed(() =>
    round2(this._lines().reduce((sum, l) => sum + l.product.price * l.quantity, 0)),
  );
  readonly discountTotal = computed(() =>
    round2(this.pricedLines().reduce((sum, l) => sum + l.unitDiscount * l.quantity, 0)),
  );
  // Net total = sum of net line subtotals (= subtotal - discountTotal).
  readonly total = computed(() =>
    round2(this.pricedLines().reduce((sum, l) => sum + l.lineSubtotal, 0)),
  );

  readonly brandGroups = computed<CartBrandGroup[]>(() => {
    const groups = new Map<string, CartBrandGroup>();

    for (const line of this.pricedLines()) {
      const brandId = line.product.brandId || 'unknown-brand';
      let group = groups.get(brandId);
      if (!group) {
        group = {
          brandId,
          brandName: line.product.brandName ?? 'Sin marca',
          itemCount: 0,
          lines: [],
          total: 0,
        };
        groups.set(brandId, group);
      }

      group.lines.push(line);
      group.itemCount += line.quantity;
      group.total += line.lineSubtotal;
    }

    return [...groups.values()].map((group) => ({ ...group, total: round2(group.total) }));
  });

  readonly allLinesValid = computed(() => this.pricedLines().every((l) => l.valid));
  readonly isCardPayment = computed(
    () => this._paymentMethod() === 'CreditCard' || this._paymentMethod() === 'DebitCard',
  );
  // A card payment needs its brand; otherwise the backend validator rejects it.
  readonly canSubmit = computed(
    () =>
      !this.isEmpty() &&
      this.allLinesValid() &&
      (!this.isCardPayment() || this._cardBrand() !== null),
  );

  add(product: ProductResponse): void {
    if (product.currentStock <= 0) return;
    this._lines.update((lines) => {
      const existing = lines.find((l) => l.product.id === product.id);
      if (existing) {
        return lines.map((l) =>
          l.product.id === product.id
            ? { ...l, quantity: Math.min(l.quantity + 1, product.currentStock) }
            : l,
        );
      }
      return [...lines, { product, quantity: 1, discountType: 'None', discountValue: null }];
    });
  }

  increment(productId: string): void {
    this._lines.update((lines) =>
      lines.map((l) =>
        l.product.id === productId
          ? { ...l, quantity: Math.min(l.quantity + 1, l.product.currentStock) }
          : l,
      ),
    );
  }

  decrement(productId: string): void {
    this._lines.update((lines) =>
      lines.map((l) =>
        l.product.id === productId ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l,
      ),
    );
  }

  setQuantity(productId: string, quantity: number): void {
    this._lines.update((lines) =>
      lines.map((l) =>
        l.product.id === productId
          ? { ...l, quantity: clamp(Math.round(quantity || 1), 1, l.product.currentStock) }
          : l,
      ),
    );
  }

  remove(productId: string): void {
    this._lines.update((lines) => lines.filter((l) => l.product.id !== productId));
  }

  setPaymentMethod(method: PaymentMethod): void {
    this._paymentMethod.set(method);
    // Clear the card brand whenever the method is not a card so we never send a
    // stale brand for Cash/Transfer.
    if (method !== 'CreditCard' && method !== 'DebitCard') {
      this._cardBrand.set(null);
    }
  }

  setCardBrand(brand: CardBrand | null): void {
    this._cardBrand.set(brand);
  }

  setLineDiscountType(productId: string, type: SaleDetailDiscountType): void {
    this._lines.update((lines) =>
      lines.map((l) =>
        l.product.id === productId
          ? // Drop the value when switching to 'None' so we never send a stale amount.
            { ...l, discountType: type, discountValue: type === 'None' ? null : l.discountValue }
          : l,
      ),
    );
  }

  setLineDiscountValue(productId: string, value: number | null): void {
    this._lines.update((lines) =>
      lines.map((l) => (l.product.id === productId ? { ...l, discountValue: value } : l)),
    );
  }

  setObservations(value: string): void {
    this._observations.set(value);
  }

  clear(): void {
    this._lines.set([]);
    this._paymentMethod.set(DEFAULT_PAYMENT_METHOD);
    this._cardBrand.set(null);
    this._observations.set('');
  }

  toCreateRequest(): CreateSaleRequest {
    const observations = this._observations().trim();
    return {
      paymentMethod: this._paymentMethod(),
      cardBrand: this.isCardPayment() ? this._cardBrand() : null,
      details: this._lines().map((l) => toDetailRequest(l)),
      observations: observations.length > 0 ? observations : null,
    };
  }
}

function toDetailRequest(line: CartLine): CreateSaleDetailRequest {
  const base: CreateSaleDetailRequest = { productId: line.product.id, quantity: line.quantity };
  if (!hasActiveDiscount(line)) return base;
  return { ...base, discountType: line.discountType, discountValue: line.discountValue };
}

// True when the line carries a usable discount (type set and a positive value).
function hasActiveDiscount(line: CartLine): boolean {
  return line.discountType !== 'None' && line.discountValue != null && line.discountValue > 0;
}

// Per-unit discount, mirroring the backend's ResolveSaleDetailPricing. Returns 0
// for no/invalid discount; validity is checked separately by isLineDiscountValid.
function lineUnitDiscount(line: CartLine): number {
  if (!hasActiveDiscount(line)) return 0;
  const value = line.discountValue as number;
  if (line.discountType === 'Percentage') {
    return round2(line.product.price * (Math.min(value, 100) / 100));
  }
  // FixedAmount is per unit, capped at the unit price.
  return Math.min(value, line.product.price);
}

function isLineDiscountValid(line: CartLine): boolean {
  if (line.discountType === 'None') return true;
  const value = line.discountValue;
  if (value == null || value <= 0) return false;
  if (line.discountType === 'Percentage') return value <= 100;
  // FixedAmount: the per-unit discount can't exceed the unit price.
  return value <= line.product.price;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
