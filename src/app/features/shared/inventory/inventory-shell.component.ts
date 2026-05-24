import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import {
  ArrowRightLeft,
  ListOrdered,
  LucideAngularModule,
  Plus,
  Search,
  Upload,
} from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { BrandsService } from '../../../core/brands/brands.service';
import { ProductCategoriesService } from './product-categories.service';
import { ProductImportResponse, ProductsService } from './products.service';
import { KpiFilter, ProductResponse, StockMovementResponse } from './inventory.types';
import { InventoryKpisComponent } from './components/inventory-kpis.component';
import { MovementsTabComponent } from './components/movements-tab.component';
import { StockSearchTabComponent } from './components/stock-search-tab.component';
import { ProductFormDialogComponent } from './product-form-dialog/product-form-dialog.component';
import { ProductImportDialogComponent } from './product-import-dialog/product-import-dialog.component';
import { MovementFormDialogComponent } from './movement-form-dialog/movement-form-dialog.component';

type TabId = 'stock' | 'movements';

@Component({
  selector: 'app-inventory-shell',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    LucideAngularModule,
    InventoryKpisComponent,
    StockSearchTabComponent,
    MovementsTabComponent,
    ProductFormDialogComponent,
    ProductImportDialogComponent,
    MovementFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventory-shell.component.html',
})
export class InventoryShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly products = inject(ProductsService);
  protected readonly brands = inject(BrandsService);
  private readonly categories = inject(ProductCategoriesService);
  private readonly notifications = inject(NotificationService);

  protected readonly icons = { Plus, ArrowRightLeft, Search, ListOrdered, Upload };

  protected readonly role = this.auth.role;
  protected readonly currentUser = this.auth.user;

  // Capability gates
  protected readonly isReadOnly = computed(() => this.role() === 'BrandManager');
  protected readonly canCreateProduct = computed(() => {
    const r = this.role();
    return r === 'Admin' || r === 'SuperAdmin' || r === 'Seller';
  });
  protected readonly canEditProduct = computed(() => {
    const r = this.role();
    return r === 'Admin' || r === 'SuperAdmin' || r === 'Seller' || r === 'BrandManager';
  });
  protected readonly canArchiveProduct = computed(() => this.canCreateProduct());
  protected readonly canRegisterMovement = computed(() => {
    const r = this.role();
    return r === 'Admin' || r === 'SuperAdmin' || r === 'Seller';
  });
  // Mirrors backend authorization on POST /api/products/import (BrandManager
  // is blocked). Same role set as create today; kept as its own computed so
  // future divergence stays explicit.
  protected readonly canImportProducts = computed(() => {
    const r = this.role();
    return r === 'Admin' || r === 'SuperAdmin' || r === 'Seller';
  });

  protected readonly kpiVariant = computed<'store' | 'brand'>(() =>
    this.role() === 'BrandManager' ? 'brand' : 'store',
  );

  // Backend: SuperAdmin/Admin/Seller can pass `includeInactive=true` on the
  // products search. Hide the toggle from BrandManager to avoid confusing UI.
  protected readonly canSeeArchived = computed(() => {
    const r = this.role();
    return r === 'Admin' || r === 'SuperAdmin' || r === 'Seller';
  });

  // BrandManager: server-side enforces this from JWT, but we also pass it to
  // the search tab so it shows the right items even on first paint.
  protected readonly brandScope = computed<string | null>(() =>
    this.role() === 'BrandManager' ? (this.currentUser()?.brandId ?? null) : null,
  );

  protected readonly headerTitle = computed(() =>
    this.role() === 'BrandManager' ? 'Mi Stock' : 'Control de Inventario',
  );
  protected readonly headerSubtitle = computed(() =>
    this.role() === 'BrandManager'
      ? 'Inventario de tu marca'
      : 'Stock de todas las marcas asociadas',
  );

  // Tabs
  protected readonly activeTab = signal<TabId>('stock');

  // Active KPI — store variant only. Drives which list <app-stock-search-tab>
  // renders (full search vs. immobilized-stock vs. critical+out-of-stock).
  protected readonly activeKpi = signal<KpiFilter>('all');

  protected onKpiSelected(kpi: KpiFilter): void {
    this.activeKpi.set(kpi);
    if (this.activeTab() !== 'stock') this.activeTab.set('stock');
  }

  // Product dialog state
  protected readonly productDialogVisible = signal(false);
  protected readonly productDialogMode = signal<'create' | 'edit'>('create');
  protected readonly productDialogEditing = signal<ProductResponse | null>(null);

  // Import dialog state
  protected readonly importDialogVisible = signal(false);
  // Optional ref to the stock search tab; only present while activeTab === 'stock'.
  // We use it to refresh the list after a bulk import (no optimistic update path).
  private readonly stockTab = viewChild<StockSearchTabComponent>('stockTab');

  // Movement dialog state
  protected readonly movementDialogVisible = signal(false);
  protected readonly movementDialogProduct = signal<ProductResponse | null>(null);

  // Archive dialog state
  protected readonly archiveDialogVisible = signal(false);
  protected readonly archiveTarget = signal<ProductResponse | null>(null);
  protected readonly archiveSkuInput = signal('');
  protected readonly archiving = signal(false);
  protected readonly canConfirmArchive = computed(
    () => this.archiveSkuInput().trim().toUpperCase() === (this.archiveTarget()?.sku ?? ''),
  );

  ngOnInit(): void {
    // Brands are needed by the form dialog selector, the search filter (Admin
    // / Seller), and chip rendering on each row. Backend allows any auth role
    // to GET /brands.
    this.brands.list({ page: 1, pageSize: 100 }).subscribe({ error: () => {} });
    this.categories.list().subscribe({ error: () => {} });

    const scope = this.brandScope() ?? undefined;

    // KPI counts (3 lightweight calls — fast).
    this.products.loadKpiCounts(scope).subscribe({ error: () => {} });

    // Both variants need the full visible list to sum currentStock for the
    // "units in local" / "Valor Inventario" KPIs. The list view itself uses
    // its own paginated search; this call is purely for aggregates.
    this.products.loadAll(scope).subscribe({ error: () => {} });
    // Immobilized count for the "Stock Inmovilizado" KPI (store variant only,
    // but harmless on brand variant — it just won't be rendered).
    this.products.loadImmobilizedCount(scope, 60).subscribe({ error: () => {} });
  }

  // ---- Product CRUD ------------------------------------------------------

  protected openCreateProduct(): void {
    this.productDialogMode.set('create');
    this.productDialogEditing.set(null);
    this.productDialogVisible.set(true);
  }

  protected openEditProduct(product: ProductResponse): void {
    this.productDialogMode.set('edit');
    this.productDialogEditing.set(product);
    this.productDialogVisible.set(true);
  }

  protected onProductSaved(): void {
    // ProductsService applies optimistic updates. Refresh KPIs so counts and
    // value totals track the change.
    const scope = this.brandScope() ?? undefined;
    this.products.loadKpiCounts(scope).subscribe({ error: () => {} });
    this.products.loadAll(scope).subscribe({ error: () => {} });
    this.products.loadImmobilizedCount(scope, 60).subscribe({ error: () => {} });
  }

  // ---- Bulk import -------------------------------------------------------

  protected openImportProducts(): void {
    this.importDialogVisible.set(true);
  }

  protected onProductsImported(res: ProductImportResponse): void {
    const created = res.created;
    this.notifications.success(
      created === 1 ? 'Se importó 1 artículo.' : `Se importaron ${created} artículos.`,
    );
    // The bulk endpoint doesn't apply optimistic updates, so re-run the
    // current search via the tab's own filter state (preserves searchTerm,
    // page, advanced filters). If the user is on the movements tab, the
    // stock tab will fetch fresh data when they switch back.
    this.stockTab()?.refresh();
    this.onProductSaved();
  }

  protected openArchiveProductDialog(product: ProductResponse): void {
    this.archiveTarget.set(product);
    this.archiveSkuInput.set('');
    this.archiveDialogVisible.set(true);
  }

  protected onArchiveDialogVisibleChange(value: boolean): void {
    if (!value && this.archiving()) return;
    this.archiveDialogVisible.set(value);
    if (!value) this.resetArchiveDialog();
  }

  protected cancelArchive(): void {
    if (this.archiving()) return;
    this.archiveDialogVisible.set(false);
    this.resetArchiveDialog();
  }

  protected confirmArchive(): void {
    const target = this.archiveTarget();
    if (!target || !this.canConfirmArchive() || this.archiving()) return;
    this.archiving.set(true);
    this.products.archive(target.id).subscribe({
      next: () => {
        this.archiving.set(false);
        this.notifications.success(`Se archivó ${target.name}.`);
        this.archiveDialogVisible.set(false);
        this.resetArchiveDialog();
        this.stockTab()?.refresh();
        this.onProductSaved(); // refresh KPIs
      },
      error: (_err: HttpErrorResponse) => {
        this.archiving.set(false);
        // error.interceptor already shows a toast
      },
    });
  }

  private resetArchiveDialog(): void {
    this.archiveTarget.set(null);
    this.archiveSkuInput.set('');
  }

  // ---- Movements ---------------------------------------------------------

  protected openMovementDialog(): void {
    this.movementDialogProduct.set(null);
    this.movementDialogVisible.set(true);
  }

  protected onMovementDialogVisibleChange(value: boolean): void {
    this.movementDialogVisible.set(value);
    if (!value) this.movementDialogProduct.set(null);
  }

  protected onMovementSaved(_movement: StockMovementResponse): void {
    // Service already updated the product's currentStock locally for both the
    // search list and allItems. Refresh KPI counts in case the change crossed
    // a status boundary (OK → Crítico → Agotado) or a sale moved a product
    // out of immobilized.
    const scope = this.brandScope() ?? undefined;
    this.products.loadKpiCounts(scope).subscribe({ error: () => {} });
    this.products.loadImmobilizedCount(scope, 60).subscribe({ error: () => {} });
  }
}
