import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { ConfirmationService } from 'primeng/api';
import { AlertTriangle, Ban, LucideAngularModule, LucideIconData } from 'lucide-angular';

import { NotificationService } from '../../../../core/notifications/notification.service';
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
  saleTypeStatusLabel,
  saleTypeStatusSeverity,
  type SaleTagSeverity,
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
  imports: [
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    TagModule,
    LucideAngularModule,
    ProductImageComponent,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-detail-dialog.component.html',
})
export class SaleDetailDialogComponent {
  private readonly sales = inject(SalesService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmation = inject(ConfirmationService);

  readonly visible = input.required<boolean>();
  readonly visibleChange = output<boolean>();
  readonly saleId = input<string | null>(null);
  readonly brandScopeId = input<string | null>(null);
  readonly allowSaleActions = input(false);
  readonly saleChanged = output<string>();
  readonly returnRequested = output<string>();

  protected readonly icons = { AlertTriangle, Ban };
  protected readonly sale = signal<SaleResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canceling = signal(false);

  protected readonly canOperateSale = computed(() => {
    const s = this.sale();
    return this.allowSaleActions() && s?.type === 'Sale' && s.status === 'Completed';
  });

  // Detail lines grouped by brand, with a per-brand subtotal. Preserves the
  // order brands first appear in the sale.
  protected readonly brandGroups = computed(() => {
    const s = this.sale();
    if (!s) return [];
    const brandScopeId = this.brandScopeId();
    const details = brandScopeId
      ? s.details.filter((detail) => detail.brandId === brandScopeId)
      : s.details;
    const groups = new Map<
      string,
      { brandId: string; brandName: string; items: SaleDetailResponse[]; total: number }
    >();
    for (const d of details) {
      const brandId = d.brandId;
      const name = d.brandName ?? 'Sin marca';
      let g = groups.get(brandId);
      if (!g) {
        g = { brandId, brandName: name, items: [], total: 0 };
        groups.set(brandId, g);
      }
      g.items.push(d);
      g.total += d.subTotal;
    }
    return [...groups.values()];
  });

  protected readonly visibleTotal = computed(() =>
    this.brandGroups().reduce((acc, group) => acc + group.total, 0),
  );

  // Funnel every fetch through switchMap so opening a different sale cancels
  // the in-flight request — otherwise a slow earlier response could land last
  // and show the wrong sale's data.
  private readonly loadTrigger$ = new Subject<string>();

  constructor() {
    this.loadTrigger$
      .pipe(
        switchMap((id) => {
          this.sale.set(null);
          this.error.set(null);
          this.loading.set(true);
          this.canceling.set(false);
          return this.sales.getById(id).pipe(
            tap({
              next: (s) => {
                this.sale.set(s);
                this.loading.set(false);
              },
              error: () => {
                this.error.set('No se pudo cargar el detalle de la venta.');
                this.loading.set(false);
              },
            }),
            catchError(() => EMPTY),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Fetch the full detail each time the dialog opens for a sale. untracked()
    // so re-renders that don't change visible()/saleId() never refetch.
    effect(() => {
      const open = this.visible();
      const id = this.saleId();
      if (open && id) untracked(() => this.loadTrigger$.next(id));
    });
  }

  protected onVisibleChange(value: boolean): void {
    if (!value && this.canceling()) return;
    this.visibleChange.emit(value);
  }

  protected requestReturn(): void {
    const s = this.sale();
    if (!s || !this.canOperateSale()) return;
    this.returnRequested.emit(s.id);
  }

  protected confirmCancel(): void {
    const s = this.sale();
    if (!s || !this.canOperateSale() || this.canceling()) return;

    const ticket = s.ticketId ? ` el ticket ${s.ticketId}` : ' esta venta';
    this.confirmation.confirm({
      header: 'Anular venta',
      message: `¿Seguro que querés anular${ticket}? Esta acción ajusta el stock y no se puede deshacer desde el sistema.`,
      acceptLabel: 'Sí, anular venta',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      defaultFocus: 'reject',
      accept: () => this.cancelSale(s.id),
    });
  }

  private cancelSale(id: string): void {
    if (this.canceling()) return;
    this.canceling.set(true);
    this.sales.cancel(id).subscribe({
      next: () => {
        this.canceling.set(false);
        this.notifications.success('La venta se anuló correctamente.', 'Venta anulada');
        this.saleChanged.emit(id);
        this.loadTrigger$.next(id);
      },
      error: () => {
        this.canceling.set(false);
        // error.interceptor already shows the backend message.
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

  protected typeStatusLabel(sale: SaleResponse): string {
    return saleTypeStatusLabel(sale.type, sale.status);
  }

  protected typeStatusSeverity(sale: SaleResponse): SaleTagSeverity {
    return saleTypeStatusSeverity(sale.type, sale.status);
  }

  protected brandGroupHeaderStyle(brandId: string, brandName: string): BrandStyle {
    return brandHeaderStyle({ brandId, brandName });
  }
}
