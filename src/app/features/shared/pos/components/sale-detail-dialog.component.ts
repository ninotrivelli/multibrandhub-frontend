import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';

import { SalesService } from '../../../../core/sales/sales.service';
import {
  CardBrand,
  PaymentMethod,
  SaleDetailResponse,
  SaleResponse,
} from '../../../../core/sales/sales.types';
import {
  cardBrandLabel,
  paymentMethodIcon,
  paymentMethodLabel,
} from '../../../../core/sales/sales.utils';
import { BrandStyle, brandHeaderStyle } from '../../../../core/brands/brand-colors';
import {
  formatCurrencyUYU,
  parseBackendUtcDate,
  URUGUAY_TIME_ZONE,
} from '../../inventory/inventory.utils';
import { ProductImageComponent } from '../../inventory/components/product-image.component';

@Component({
  selector: 'app-pos-sale-detail-dialog',
  imports: [DialogModule, TagModule, LucideAngularModule, ProductImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-detail-dialog.component.html',
})
export class SaleDetailDialogComponent {
  private readonly sales = inject(SalesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = input.required<boolean>();
  readonly visibleChange = output<boolean>();
  readonly saleId = input<string | null>(null);

  protected readonly sale = signal<SaleResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  // Detail lines grouped by brand, with a per-brand subtotal. Preserves the
  // order brands first appear in the sale.
  protected readonly brandGroups = computed(() => {
    const s = this.sale();
    if (!s) return [];
    const groups = new Map<
      string,
      { brandName: string; items: SaleDetailResponse[]; total: number }
    >();
    for (const d of s.details) {
      const name = d.brandName ?? 'Sin marca';
      let g = groups.get(name);
      if (!g) {
        g = { brandName: name, items: [], total: 0 };
        groups.set(name, g);
      }
      g.items.push(d);
      g.total += d.subTotal;
    }
    return [...groups.values()];
  });

  constructor() {
    // Fetch the full detail each time the dialog opens for a sale. untracked()
    // so re-renders that don't change visible()/saleId() never refetch.
    effect(() => {
      const open = this.visible();
      const id = this.saleId();
      if (open && id) untracked(() => this.load(id));
    });
  }

  protected onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }

  private load(id: string): void {
    this.sale.set(null);
    this.error.set(null);
    this.loading.set(true);
    this.sales
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.sale.set(s);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar el detalle de la venta.');
          this.loading.set(false);
        },
      });
  }

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('es-UY', {
      timeZone: URUGUAY_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parseBackendUtcDate(iso));
  }

  protected paymentIcon(method: PaymentMethod): LucideIconData {
    return paymentMethodIcon(method);
  }

  protected paymentLabel(method: PaymentMethod): string {
    return paymentMethodLabel(method);
  }

  protected cardBrand(brand: CardBrand): string {
    return cardBrandLabel(brand);
  }

  protected brandGroupHeaderStyle(brandName: string): BrandStyle {
    return brandHeaderStyle({ brandName });
  }
}
