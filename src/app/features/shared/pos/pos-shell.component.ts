import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ButtonModule } from 'primeng/button';
import { LucideAngularModule, Undo2 } from 'lucide-angular';

import { BrandsService } from '../../../core/brands/brands.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { SalesService } from '../../../core/sales/sales.service';
import { SaleResponse } from '../../../core/sales/sales.types';
import { ProductCategoriesService } from '../inventory/product-categories.service';
import { PosCartStore } from './pos-cart.store';
import { CartPanelComponent } from './components/cart-panel.component';
import { ProductSearchPanelComponent } from './components/product-search-panel.component';
import { RecentSalesListComponent } from './components/recent-sales-list.component';
import { SaleReviewDialogComponent } from './components/sale-review-dialog.component';
import { ReturnDialogComponent } from './return/return-dialog.component';

@Component({
  selector: 'app-pos-shell',
  imports: [
    ButtonModule,
    LucideAngularModule,
    ProductSearchPanelComponent,
    CartPanelComponent,
    RecentSalesListComponent,
    SaleReviewDialogComponent,
    ReturnDialogComponent,
  ],
  providers: [PosCartStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-shell.component.html',
})
export class PosShellComponent {
  private readonly sales = inject(SalesService);
  private readonly brands = inject(BrandsService);
  private readonly categories = inject(ProductCategoriesService);
  private readonly notifications = inject(NotificationService);
  protected readonly cart = inject(PosCartStore);

  protected readonly icons = { Undo2 };

  protected readonly submitting = signal(false);
  protected readonly saleReviewVisible = signal(false);
  protected readonly returnDialogVisible = signal(false);

  private readonly searchPanel = viewChild(ProductSearchPanelComponent);
  private readonly recentList = viewChild(RecentSalesListComponent);

  constructor() {
    // Brand chips + category dropdown need their reference data. Categories
    // self-cache; only fetch brands if they aren't loaded yet.
    if (!this.brands.hasItems()) {
      this.brands.list().pipe(takeUntilDestroyed()).subscribe();
    }
    this.categories.list().pipe(takeUntilDestroyed()).subscribe();
  }

  protected openSaleReview(): void {
    if (this.submitting() || !this.cart.canSubmit()) return;
    this.saleReviewVisible.set(true);
  }

  protected confirmSale(): void {
    if (this.submitting() || !this.cart.canSubmit()) return;
    this.submitting.set(true);
    this.sales.create(this.cart.toCreateRequest()).subscribe({
      next: (sale) => {
        this.submitting.set(false);
        this.saleReviewVisible.set(false);
        this.notifications.success(this.ticketMessage('Venta registrada', sale), 'Venta ingresada');
        this.cart.clear();
        this.refreshAfterMutation();
      },
      // Error toast is surfaced by the global errorInterceptor.
      error: () => this.submitting.set(false),
    });
  }

  protected onReturnSaved(sale: SaleResponse): void {
    this.notifications.success(
      this.ticketMessage('Devolución registrada', sale),
      'Devolución ingresada',
    );
    this.refreshAfterMutation();
  }

  private ticketMessage(prefix: string, sale: SaleResponse): string {
    return sale.ticketId ? `${prefix} · Ticket ${sale.ticketId}` : prefix;
  }

  private refreshAfterMutation(): void {
    // Refetch so decremented/restored stock and the new ticket show up.
    this.searchPanel()?.refresh();
    this.recentList()?.refresh();
  }
}
