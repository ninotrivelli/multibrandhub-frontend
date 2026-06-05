import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import {
  Check,
  LucideAngularModule,
  Minus,
  Pencil,
  Percent,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-angular';

import { formatCurrencyUYU } from '../../inventory/inventory.utils';
import { ProductImageComponent } from '../../inventory/components/product-image.component';
import { PosCartStore, PricedCartLine } from '../pos-cart.store';
import { SaleDetailDiscountType } from '../../../../core/sales/sales.types';
import { PaymentMethodSelectorComponent } from './payment-method-selector.component';

@Component({
  selector: 'app-pos-cart-panel',
  imports: [
    FormsModule,
    ButtonModule,
    InputNumberModule,
    SelectButtonModule,
    TextareaModule,
    LucideAngularModule,
    ProductImageComponent,
    PaymentMethodSelectorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart-panel.component.html',
})
export class CartPanelComponent {
  protected readonly cart = inject(PosCartStore);

  readonly submitting = input<boolean>(false);
  readonly submitSale = output<void>();

  protected readonly icons = { Minus, Plus, Trash2, X, ShoppingCart, Percent, Pencil, Check };

  // Backend caps observations at 500 chars; mirror it so the user gets
  // immediate feedback instead of a server error.
  protected readonly maxObservations = 500;

  // Compact % / $ toggle for the inline discount editor. 'None' is handled by
  // the "Quitar" action, not as a selectable mode.
  protected readonly discountModeOptions: { label: string; value: SaleDetailDiscountType }[] = [
    { label: '%', value: 'Percentage' },
    { label: '$', value: 'FixedAmount' },
  ];

  // Product id of the line whose discount editor is expanded (null = none).
  // Keeps every other line collapsed so the cart stays compact by default.
  protected readonly editingDiscountFor = signal<string | null>(null);

  protected openDiscountEditor(line: PricedCartLine): void {
    // First time on a line with no discount: default to percentage so the editor
    // shows a value input immediately.
    if (line.discountType === 'None') {
      this.cart.setLineDiscountType(line.product.id, 'Percentage');
    }
    this.editingDiscountFor.set(line.product.id);
  }

  protected closeDiscountEditor(): void {
    this.editingDiscountFor.set(null);
  }

  protected setDiscountMode(productId: string, type: SaleDetailDiscountType): void {
    this.cart.setLineDiscountType(productId, type);
  }

  protected clearLineDiscount(productId: string): void {
    this.cart.setLineDiscountType(productId, 'None');
    this.editingDiscountFor.set(null);
  }

  protected discountChipLabel(line: PricedCartLine): string {
    if (line.discountType === 'Percentage') return `−${line.discountValue}%`;
    return `−${this.formatCurrency(line.discountValue ?? 0)} c/u`;
  }

  protected lineSavings(line: PricedCartLine): number {
    return line.unitDiscount * line.quantity;
  }

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }

  protected onSubmit(): void {
    if (!this.cart.canSubmit() || this.submitting()) return;
    this.submitSale.emit();
  }
}
