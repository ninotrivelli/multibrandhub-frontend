import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SelectModule } from 'primeng/select';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';

import { CardBrand, PaymentMethod } from '../../../../core/sales/sales.types';
import {
  cardBrandLabel,
  paymentMethodIcon,
  paymentMethodLabel,
} from '../../../../core/sales/sales.utils';
import { PosCartStore } from '../pos-cart.store';

interface PaymentOption {
  value: PaymentMethod;
  label: string;
  icon: LucideIconData;
}

const SELECTABLE_METHODS: PaymentMethod[] = ['Cash', 'DebitCard', 'CreditCard', 'Transfer'];
const SELECTABLE_CARD_BRANDS: CardBrand[] = ['Visa', 'MasterCard', 'Oca', 'Other'];

@Component({
  selector: 'app-pos-payment-method-selector',
  imports: [FormsModule, SelectModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-method-selector.component.html',
})
export class PaymentMethodSelectorComponent {
  protected readonly cart = inject(PosCartStore);

  // Each tile maps 1:1 to a backend PaymentMethod, so Débito/Crédito are
  // first-class choices rather than a nested toggle under "Tarjeta". Labels and
  // icons come from the shared sales.utils so the recent-sales list stays in sync.
  protected readonly options: PaymentOption[] = SELECTABLE_METHODS.map((value) => ({
    value,
    label: paymentMethodLabel(value),
    icon: paymentMethodIcon(value),
  }));

  protected readonly cardBrandOptions: { label: string; value: CardBrand }[] =
    SELECTABLE_CARD_BRANDS.map((value) => ({ label: cardBrandLabel(value), value }));

  protected select(method: PaymentMethod): void {
    this.cart.setPaymentMethod(method);
  }

  protected setCardBrand(brand: CardBrand | null): void {
    this.cart.setCardBrand(brand);
  }
}
