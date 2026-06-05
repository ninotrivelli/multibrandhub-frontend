import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SkeletonModule } from 'primeng/skeleton';
import {
  Calculator,
  LucideAngularModule,
  PackageCheck,
  ReceiptText,
  WalletCards,
} from 'lucide-angular';

import { SalesDashboardKpisResponse } from '../../../core/sales/sales.types';
import { formatCurrencyUYU, formatNumber } from '../inventory/inventory.utils';

@Component({
  selector: 'app-sales-dashboard-kpis',
  imports: [LucideAngularModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-dashboard-kpis.component.html',
})
export class SalesDashboardKpisComponent {
  readonly kpis = input<SalesDashboardKpisResponse | null>(null);
  readonly loading = input(false);

  protected readonly icons = { WalletCards, ReceiptText, PackageCheck, Calculator };

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }

  protected formatNumber(value: number): string {
    return formatNumber(value);
  }
}
