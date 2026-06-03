import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { LucideAngularModule, Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-angular';

import { formatCurrencyUYU } from '../../inventory/inventory.utils';
import { PosCartStore } from '../pos-cart.store';
import { SaleDetailDiscountType } from '../../../../core/sales/sales.types';
import { PaymentMethodSelectorComponent } from './payment-method-selector.component';

@Component({
  selector: 'app-pos-cart-panel',
  imports: [
    FormsModule,
    ButtonModule,
    InputNumberModule,
    SelectModule,
    TextareaModule,
    LucideAngularModule,
    PaymentMethodSelectorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart-panel.component.html',
})
export class CartPanelComponent {
  protected readonly cart = inject(PosCartStore);

  readonly submitting = input<boolean>(false);
  readonly submitSale = output<void>();

  protected readonly icons = { Minus, Plus, Trash2, X, ShoppingCart };

  // Backend caps observations at 500 chars; mirror it so the user gets
  // immediate feedback instead of a server error.
  protected readonly maxObservations = 500;

  protected readonly discountTypeOptions: { label: string; value: SaleDetailDiscountType }[] = [
    { label: 'Sin descuento', value: 'None' },
    { label: 'Porcentaje %', value: 'Percentage' },
    { label: 'Monto fijo', value: 'FixedAmount' },
  ];

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }

  protected onSubmit(): void {
    if (!this.cart.canSubmit() || this.submitting()) return;
    this.submitSale.emit();
  }
}
