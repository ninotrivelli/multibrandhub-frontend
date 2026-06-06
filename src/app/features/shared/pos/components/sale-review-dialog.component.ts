import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Check, LucideAngularModule, Undo2 } from 'lucide-angular';

import { CardBrand, PaymentMethod } from '../../../../core/sales/sales.types';
import {
  cardBrandLabel,
  paymentMethodIcon,
  paymentMethodLabel,
} from '../../../../core/sales/sales.utils';
import { BrandStyle, brandHeaderStyle } from '../../../../core/brands/brand-colors';
import { ProductImageComponent } from '../../inventory/components/product-image.component';
import { formatCurrencyUYU } from '../../inventory/inventory.utils';
import { PosCartStore, PricedCartLine } from '../pos-cart.store';

@Component({
  selector: 'app-pos-sale-review-dialog',
  imports: [ButtonModule, DialogModule, LucideAngularModule, ProductImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-review-dialog.component.html',
})
export class SaleReviewDialogComponent {
  protected readonly cart = inject(PosCartStore);

  readonly visible = input.required<boolean>();
  readonly visibleChange = output<boolean>();
  readonly submitting = input<boolean>(false);
  readonly confirm = output<void>();

  protected readonly icons = { Check, Undo2 };

  protected onVisibleChange(value: boolean): void {
    if (this.submitting() && !value) return;
    this.visibleChange.emit(value);
  }

  protected close(): void {
    if (this.submitting()) return;
    this.visibleChange.emit(false);
  }

  protected confirmSale(): void {
    if (!this.cart.canSubmit() || this.submitting()) return;
    this.confirm.emit();
  }

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }

  protected paymentLabel(method: PaymentMethod): string {
    return paymentMethodLabel(method);
  }

  protected paymentIcon(method: PaymentMethod) {
    return paymentMethodIcon(method);
  }

  protected cardBrandLabel(brand: CardBrand): string {
    return cardBrandLabel(brand);
  }

  protected brandGroupHeaderStyle(brandId: string, brandName: string): BrandStyle {
    return brandHeaderStyle({ brandId, brandName });
  }

  protected discountLabel(line: PricedCartLine): string {
    if (line.discountType === 'Percentage') return `Desc. ${line.discountValue}%`;
    return `Desc. ${this.formatCurrency(line.discountValue ?? 0)} c/u`;
  }
}
