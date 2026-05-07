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
import { BrandsService } from '../../admin/settings/marcas/brands.service';
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
  template: `
    <div class="flex flex-col gap-5">
      <!-- Header -->
      <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-surface-900 dark:text-surface-0">
            {{ headerTitle() }}
          </h1>
          <p class="text-sm text-surface-500 dark:text-surface-400">
            {{ headerSubtitle() }}
          </p>
        </div>
        @if (canRegisterMovement() || canCreateProduct() || canImportProducts()) {
          <div class="flex flex-wrap items-center gap-2">
            @if (canRegisterMovement()) {
              <button
                pButton
                type="button"
                severity="secondary"
                [outlined]="true"
                label="Reg. Movimiento"
                (click)="openMovementDialog()"
              >
                <i-lucide [img]="icons.ArrowRightLeft" class="size-4 mr-2" />
              </button>
            }
            @if (canImportProducts()) {
              <button
                pButton
                type="button"
                severity="secondary"
                label="Importar varios artículos"
                (click)="openImportProducts()"
              >
                <i-lucide [img]="icons.Upload" class="size-4 mr-2" />
              </button>
            }
            @if (canCreateProduct()) {
              <button pButton type="button" label="Nuevo Artículo" (click)="openCreateProduct()">
                <i-lucide [img]="icons.Plus" class="size-4 mr-2" />
              </button>
            }
          </div>
        }
      </header>

      <!-- KPIs -->
      <app-inventory-kpis
        [variant]="kpiVariant()"
        [activeKpi]="activeKpi()"
        (kpiSelected)="onKpiSelected($event)"
      />

      <!-- Tabs + content -->
      <div class="flex flex-col gap-3">
        <div
          class="flex items-center gap-1 border-b border-surface-200 dark:border-surface-700 -mb-px overflow-x-auto"
        >
          <button
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer"
            [class.border-primary]="activeTab() === 'stock'"
            [class.text-primary]="activeTab() === 'stock'"
            [class.border-transparent]="activeTab() !== 'stock'"
            [class.text-surface-500]="activeTab() !== 'stock'"
            [class.dark:text-surface-400]="activeTab() !== 'stock'"
            [class.hover:text-surface-700]="activeTab() !== 'stock'"
            (click)="activeTab.set('stock')"
          >
            <i-lucide [img]="icons.Search" class="size-4" />
            Buscador de Stock
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer"
            [class.border-primary]="activeTab() === 'movements'"
            [class.text-primary]="activeTab() === 'movements'"
            [class.border-transparent]="activeTab() !== 'movements'"
            [class.text-surface-500]="activeTab() !== 'movements'"
            [class.dark:text-surface-400]="activeTab() !== 'movements'"
            [class.hover:text-surface-700]="activeTab() !== 'movements'"
            (click)="activeTab.set('movements')"
          >
            <i-lucide [img]="icons.ListOrdered" class="size-4" />
            Movimientos
          </button>
        </div>

        @if (activeTab() === 'stock') {
          <app-stock-search-tab
            #stockTab
            [canEdit]="canEditProduct()"
            [canDelete]="canDeleteProduct()"
            [showBrandFilter]="kpiVariant() === 'store'"
            [canSeeArchived]="canSeeArchived()"
            [brandScope]="brandScope()"
            [kpiFilter]="activeKpi()"
            (editProduct)="openEditProduct($event)"
            (deleteProduct)="openDeleteProductDialog($event)"
          />
        } @else {
          <app-movements-tab
            [showBrandFilter]="kpiVariant() === 'store'"
            [brandScope]="brandScope()"
          />
        }
      </div>
    </div>

    <!-- Product form dialog -->
    <app-product-form-dialog
      [visible]="productDialogVisible()"
      [mode]="productDialogMode()"
      [editing]="productDialogEditing()"
      (visibleChange)="productDialogVisible.set($event)"
      (saved)="onProductSaved()"
    />

    <!-- Product import dialog -->
    <app-product-import-dialog
      [visible]="importDialogVisible()"
      [brands]="brands.items()"
      (visibleChange)="importDialogVisible.set($event)"
      (imported)="onProductsImported($event)"
    />

    <!-- Movement form dialog -->
    <app-movement-form-dialog
      [visible]="movementDialogVisible()"
      [initialProduct]="movementDialogProduct()"
      (visibleChange)="onMovementDialogVisibleChange($event)"
      (saved)="onMovementSaved($event)"
    />

    <!-- Delete confirm dialog -->
    <p-dialog
      [visible]="deleteDialogVisible()"
      (visibleChange)="onDeleteDialogVisibleChange($event)"
      [modal]="true"
      [closable]="!deleting()"
      [closeOnEscape]="!deleting()"
      [dismissableMask]="!deleting()"
      [draggable]="false"
      [style]="{ width: '32rem', maxWidth: '95vw' }"
      header="Eliminar artículo"
    >
      @if (deleteTarget(); as p) {
        <div class="flex flex-col gap-4">
          <div
            class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            El artículo se da de baja (soft delete). El historial de ventas y movimientos se
            conserva.
          </div>
          <div class="flex flex-col gap-2 text-sm text-surface-700 dark:text-surface-200">
            <p>
              ¿Eliminar <strong>{{ p.name }}</strong> ({{ p.sku }})?
            </p>
            <p class="text-xs text-surface-500 dark:text-surface-400">
              Para confirmar, escribí el SKU abajo.
            </p>
            <input
              pInputText
              type="text"
              [ngModel]="deleteSkuInput()"
              (ngModelChange)="deleteSkuInput.set($event)"
              placeholder="SKU del artículo"
              fluid
            />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button
              pButton
              type="button"
              severity="secondary"
              [text]="true"
              label="Cancelar"
              [disabled]="deleting()"
              (click)="cancelDelete()"
            ></button>
            <button
              pButton
              type="button"
              severity="danger"
              label="Eliminar"
              [loading]="deleting()"
              [disabled]="!canConfirmDelete() || deleting()"
              (click)="confirmDelete()"
            ></button>
          </div>
        </div>
      }
    </p-dialog>
  `,
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
  protected readonly canDeleteProduct = computed(() => this.canCreateProduct());
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

  // Backend: only SuperAdmin/Admin can pass `includeInactive=true` on the
  // products search. Hide the toggle from other roles to avoid confusing UI.
  protected readonly canSeeArchived = computed(() => {
    const r = this.role();
    return r === 'Admin' || r === 'SuperAdmin';
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

  // Delete dialog state
  protected readonly deleteDialogVisible = signal(false);
  protected readonly deleteTarget = signal<ProductResponse | null>(null);
  protected readonly deleteSkuInput = signal('');
  protected readonly deleting = signal(false);
  protected readonly canConfirmDelete = computed(
    () => this.deleteSkuInput().trim().toUpperCase() === (this.deleteTarget()?.sku ?? ''),
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

  protected openDeleteProductDialog(product: ProductResponse): void {
    this.deleteTarget.set(product);
    this.deleteSkuInput.set('');
    this.deleteDialogVisible.set(true);
  }

  protected onDeleteDialogVisibleChange(value: boolean): void {
    if (!value && this.deleting()) return;
    this.deleteDialogVisible.set(value);
    if (!value) this.resetDeleteDialog();
  }

  protected cancelDelete(): void {
    if (this.deleting()) return;
    this.deleteDialogVisible.set(false);
    this.resetDeleteDialog();
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target || !this.canConfirmDelete() || this.deleting()) return;
    this.deleting.set(true);
    this.products.delete(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.notifications.success(`Se eliminó ${target.name}.`);
        this.deleteDialogVisible.set(false);
        this.resetDeleteDialog();
        this.onProductSaved(); // refresh KPIs
      },
      error: (_err: HttpErrorResponse) => {
        this.deleting.set(false);
        // error.interceptor already shows a toast
      },
    });
  }

  private resetDeleteDialog(): void {
    this.deleteTarget.set(null);
    this.deleteSkuInput.set('');
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
