import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SelectModule } from 'primeng/select';
import {
  ArrowRightLeft,
  Banknote,
  CreditCard,
  LucideAngularModule,
  LucideIconData,
  Wallet,
} from 'lucide-angular';

import { CardBrand, PaymentMethod } from '../../../../core/sales/sales.types';
import { PosCartStore } from '../pos-cart.store';

interface PaymentOption {
  value: PaymentMethod;
  label: string;
  icon: LucideIconData;
}

@Component({
  selector: 'app-pos-payment-method-selector',
  imports: [FormsModule, SelectModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-method-selector.component.html',
})
export class PaymentMethodSelectorComponent {
  protected readonly cart = inject(PosCartStore);

  // Each tile maps 1:1 to a backend PaymentMethod, so Débito/Crédito are
  // first-class choices rather than a nested toggle under "Tarjeta".
  protected readonly options: PaymentOption[] = [
    { value: 'Cash', label: 'Efectivo', icon: Banknote },
    { value: 'DebitCard', label: 'Débito', icon: Wallet },
    { value: 'CreditCard', label: 'Crédito', icon: CreditCard },
    { value: 'Transfer', label: 'Transferencia', icon: ArrowRightLeft },
  ];

  protected readonly cardBrandOptions: { label: string; value: CardBrand }[] = [
    { label: 'Visa', value: 'Visa' },
    { label: 'Mastercard', value: 'MasterCard' },
    { label: 'OCA', value: 'Oca' },
    { label: 'Otra', value: 'Other' },
  ];

  protected select(method: PaymentMethod): void {
    this.cart.setPaymentMethod(method);
  }

  protected setCardBrand(brand: CardBrand | null): void {
    this.cart.setCardBrand(brand);
  }
}
