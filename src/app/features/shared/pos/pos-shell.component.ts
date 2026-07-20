import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { AlertTriangle, LucideAngularModule, Receipt, Undo2 } from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';
import { BrandsService } from '../../../core/brands/brands.service';
import { CashRegisterService } from '../../../core/cash-register/cash-register.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { SalesService } from '../../../core/sales/sales.service';
import { SaleResponse } from '../../../core/sales/sales.types';
import { ProductCategoriesService } from '../../../core/product-categories/product-categories.service';
import { PosCartStore } from './pos-cart.store';
import { CartPanelComponent } from './components/cart-panel.component';
import { ProductSearchPanelComponent } from './components/product-search-panel.component';
import { RecentSalesListComponent } from './components/recent-sales-list.component';
import { SaleReviewDialogComponent } from './components/sale-review-dialog.component';
import { ReturnDialogComponent } from './return/return-dialog.component';

type PendingStaleCashOperation = { kind: 'sale' } | { kind: 'return'; saleId: string | null };

@Component({
  selector: 'app-pos-shell',
  imports: [
    ButtonModule,
    DialogModule,
    LucideAngularModule,
    RouterLink,
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
  private readonly auth = inject(AuthService);
  private readonly sales = inject(SalesService);
  private readonly brands = inject(BrandsService);
  private readonly cashRegister = inject(CashRegisterService);
  private readonly categories = inject(ProductCategoriesService);
  private readonly notifications = inject(NotificationService);
  protected readonly cart = inject(PosCartStore);

  protected readonly icons = { AlertTriangle, Receipt, Undo2 };

  protected readonly submitting = signal(false);
  protected readonly saleReviewVisible = signal(false);
  protected readonly returnDialogVisible = signal(false);
  protected readonly returnPreselectedSaleId = signal<string | null>(null);
  protected readonly cashClosedPromptVisible = signal(false);
  protected readonly staleCashPromptVisible = signal(false);
  protected readonly pendingStaleCashOperation = signal<PendingStaleCashOperation | null>(null);
  protected readonly noCashRegisterOpen = computed(
    () =>
      this.cashRegister.currentLoaded() &&
      !this.cashRegister.currentLoading() &&
      !this.cashRegister.currentError() &&
      this.cashRegister.current() === null,
  );
  protected readonly canOpenCashRegister = computed(() => {
    const r = this.auth.role();
    return r === 'Seller' || r === 'Admin' || r === 'SuperAdmin';
  });
  // Each role opens/closes the register under its own route.
  protected readonly cashRegisterPath = computed(() =>
    this.auth.role() === 'Seller' ? '/seller/cash-register' : '/admin/cash-register',
  );
  protected readonly staleCashRegister = this.cashRegister.hasStaleOpenRegister;
  protected readonly cashRegisterAgeText = this.cashRegister.currentAgeText;
  protected readonly pendingOperationLabel = computed(() =>
    this.pendingStaleCashOperation()?.kind === 'return' ? 'devolución' : 'venta',
  );

  private readonly searchPanel = viewChild(ProductSearchPanelComponent);
  private readonly recentList = viewChild(RecentSalesListComponent);

  constructor() {
    // Brand chips + category dropdown need their reference data. Categories
    // self-cache; only fetch brands if they aren't loaded yet.
    if (!this.brands.hasItems()) {
      this.brands.list().pipe(takeUntilDestroyed()).subscribe();
    }
    this.categories.list().pipe(takeUntilDestroyed()).subscribe();
    this.cashRegister
      .loadCurrent()
      .pipe(takeUntilDestroyed())
      .subscribe({
        error: () => {
          // error.interceptor already shows a toast.
        },
      });
  }

  protected onSubmitSale(): void {
    if (this.submitting() || !this.cart.canSubmit()) return;
    // Sales aren't blocked without an open register, but warn first so the
    // ticket isn't accidentally left out of a cash register session.
    if (this.noCashRegisterOpen()) {
      this.cashClosedPromptVisible.set(true);
      return;
    }
    if (this.staleCashRegister()) {
      this.requestStaleCashConfirmation({ kind: 'sale' });
      return;
    }
    this.openSaleReview();
  }

  protected proceedWithoutCashRegister(): void {
    this.cashClosedPromptVisible.set(false);
    this.openSaleReview();
  }

  protected openSaleReview(): void {
    if (this.submitting() || !this.cart.canSubmit()) return;
    this.saleReviewVisible.set(true);
  }

  protected openManualReturn(): void {
    this.requestReturn(null);
  }

  protected openReturnForSale(saleId: string): void {
    this.requestReturn(saleId);
  }

  protected proceedWithStaleCashRegister(): void {
    const operation = this.pendingStaleCashOperation();
    this.staleCashPromptVisible.set(false);
    this.pendingStaleCashOperation.set(null);

    if (operation?.kind === 'sale') {
      this.openSaleReview();
    } else if (operation?.kind === 'return') {
      this.openReturnDialog(operation.saleId);
    }
  }

  protected onStaleCashPromptVisibleChange(visible: boolean): void {
    this.staleCashPromptVisible.set(visible);
    if (!visible) this.pendingStaleCashOperation.set(null);
  }

  protected onReturnDialogVisibleChange(value: boolean): void {
    this.returnDialogVisible.set(value);
    if (!value) this.returnPreselectedSaleId.set(null);
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

  protected onSaleMutated(): void {
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

  private requestReturn(saleId: string | null): void {
    if (this.staleCashRegister()) {
      this.requestStaleCashConfirmation({ kind: 'return', saleId });
      return;
    }
    this.openReturnDialog(saleId);
  }

  private openReturnDialog(saleId: string | null): void {
    this.returnPreselectedSaleId.set(saleId);
    this.returnDialogVisible.set(true);
  }

  private requestStaleCashConfirmation(operation: PendingStaleCashOperation): void {
    this.pendingStaleCashOperation.set(operation);
    this.staleCashPromptVisible.set(true);
  }
}
