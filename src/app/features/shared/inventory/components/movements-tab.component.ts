import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Search, X, LucideAngularModule } from 'lucide-angular';

import { ProductsService } from '../products.service';
import { StockMovementsService } from '../stock-movements.service';
import { ProductResponse, StockMovementResponse } from '../inventory.types';
import {
  formatMovementDate,
  movementTypeLabel,
  movementTypeSeverity,
} from '../inventory.utils';
import { ProductImageComponent } from './product-image.component';

@Component({
  selector: 'app-movements-tab',
  imports: [
    FormsModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TableModule,
    TagModule,
    LucideAngularModule,
    ProductImageComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <!-- Product picker -->
      @if (selectedProduct(); as p) {
        <div
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-3 min-w-0">
            <app-product-image
              [imageUrl]="p.imageUrl"
              [categoryName]="p.categoryName"
              [alt]="p.name"
              size="md"
            />
            <div class="flex flex-col min-w-0">
              <span class="font-medium text-surface-900 dark:text-surface-0 truncate">
                {{ p.name }}
              </span>
              <span class="text-xs text-surface-500 dark:text-surface-400 truncate">
                {{ p.sku }} · {{ p.brandName }} · Stock actual:
                <strong>{{ p.currentStock }}</strong>
              </span>
            </div>
          </div>
          <button
            pButton
            type="button"
            severity="secondary"
            [text]="true"
            label="Cambiar artículo"
            size="small"
            (click)="clearSelection()"
          >
            <i-lucide [img]="icons.X" class="size-4 mr-1" />
          </button>
        </div>
      } @else {
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-200">
            Seleccionar artículo para ver su historial de movimientos
          </label>
          <p-iconfield>
            @if (searchTerm().length === 0) {
              <p-inputicon>
                <i-lucide [img]="icons.Search" class="size-4 text-surface-400" />
              </p-inputicon>
            }
            <input
              pInputText
              type="text"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              placeholder="Buscar por SKU o nombre..."
              fluid
            />
          </p-iconfield>

          @if (searchTerm().trim().length > 0) {
            <div
              class="rounded-lg border border-surface-200 dark:border-surface-700 max-h-72 overflow-y-auto divide-y divide-surface-200 dark:divide-surface-700 bg-surface-0 dark:bg-surface-800"
            >
              @if (searching()) {
                <div class="text-sm text-surface-500 dark:text-surface-400 px-3 py-3">
                  Buscando...
                </div>
              } @else if (searchResults().length === 0) {
                <div class="text-sm text-surface-500 dark:text-surface-400 px-3 py-3">
                  No se encontraron artículos.
                </div>
              } @else {
                @for (p of searchResults(); track p.id) {
                  <button
                    type="button"
                    class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-100 dark:hover:bg-surface-900 transition-colors"
                    (click)="selectProduct(p)"
                  >
                    <app-product-image
                      [imageUrl]="p.imageUrl"
                      [categoryName]="p.categoryName"
                      size="sm"
                    />
                    <div class="flex flex-col min-w-0 flex-1">
                      <span class="font-medium text-sm text-surface-900 dark:text-surface-0 truncate">
                        {{ p.name }}
                      </span>
                      <span class="text-xs text-surface-500 dark:text-surface-400 truncate">
                        {{ p.sku }} · {{ p.brandName }}
                      </span>
                    </div>
                    <span
                      class="text-xs text-surface-500 dark:text-surface-400 whitespace-nowrap shrink-0"
                    >
                      Stock: {{ p.currentStock }}
                    </span>
                  </button>
                }
              }
            </div>
          } @else {
            <p class="text-sm text-surface-500 dark:text-surface-400">
              Tip: empezá a escribir para buscar artículos por SKU, nombre, talle o color.
            </p>
          }
        </div>
      }

      <!-- Movements table -->
      @if (selectedProduct()) {
        <div
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden"
        >
          <p-table
            [value]="movements()"
            [lazy]="true"
            [paginator]="true"
            [rows]="pageSize()"
            [first]="(page() - 1) * pageSize()"
            [totalRecords]="totalCount()"
            [rowsPerPageOptions]="[20, 50, 100]"
            [loading]="loadingMovements()"
            (onLazyLoad)="onLazyLoad($event)"
            dataKey="id"
            styleClass="p-datatable-sm"
            responsiveLayout="scroll"
            [showCurrentPageReport]="true"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} movimientos"
          >
            <ng-template pTemplate="header">
              <tr>
                <th class="min-w-44">FECHA / HORA</th>
                <th class="min-w-32">TIPO</th>
                <th class="text-right min-w-24">CANTIDAD</th>
                <th class="hidden lg:table-cell">USUARIO</th>
                <th class="min-w-56">MOTIVO / OBSERVACIONES</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-row>
              <tr>
                <td>
                  <span class="text-sm text-surface-700 dark:text-surface-200">
                    {{ formatDate(row.date) }}
                  </span>
                </td>
                <td>
                  <p-tag
                    [value]="typeLabel(row)"
                    [severity]="typeSeverity(row)"
                    styleClass="!text-xs !font-semibold !px-2 !py-0.5"
                  />
                </td>
                <td class="text-right">
                  <span
                    class="font-bold"
                    [class.text-emerald-600]="row.quantity > 0"
                    [class.dark:text-emerald-300]="row.quantity > 0"
                    [class.text-red-600]="row.quantity < 0"
                    [class.dark:text-red-300]="row.quantity < 0"
                  >
                    {{ row.quantity > 0 ? '+' : '' }}{{ row.quantity }}
                  </span>
                </td>
                <td class="hidden lg:table-cell">
                  <span class="text-sm text-surface-600 dark:text-surface-300">
                    {{ row.userFullName ?? 'Sistema' }}
                  </span>
                </td>
                <td>
                  <span class="text-sm text-surface-700 dark:text-surface-200">
                    {{ row.observations ?? '—' }}
                  </span>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="5" class="text-center py-10 text-surface-500 dark:text-surface-400">
                  Este artículo todavía no tiene movimientos registrados.
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      }
    </div>
  `,
})
export class MovementsTabComponent {
  private readonly products = inject(ProductsService);
  private readonly movementsSvc = inject(StockMovementsService);

  protected readonly icons = { Search, X };

  protected readonly searchTerm = signal('');
  protected readonly selectedProduct = signal<ProductResponse | null>(null);
  protected readonly searching = signal(false);

  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);

  protected readonly movements = this.movementsSvc.movements;
  protected readonly totalCount = this.movementsSvc.totalCount;
  protected readonly loadingMovements = this.movementsSvc.loading;

  private readonly searchResults$ = toObservable(this.searchTerm).pipe(
    debounceTime(250),
    distinctUntilChanged(),
    switchMap((term) => {
      if (this.selectedProduct() !== null) return of([] as ProductResponse[]);
      if (!term || term.trim().length < 1) {
        this.searching.set(false);
        return of([] as ProductResponse[]);
      }
      this.searching.set(true);
      return this.products
        .search({ searchTerm: term, page: 1, pageSize: 8 })
        .pipe(switchMap((res) => of(res.items)));
    }),
  );

  protected readonly searchResults = toSignal(this.searchResults$, { initialValue: [] });

  constructor() {
    // Stop spinner when results land.
    effect(() => {
      this.searchResults();
      untracked(() => this.searching.set(false));
    });

    // When a product is selected, fetch its movements.
    effect(() => {
      const p = this.selectedProduct();
      untracked(() => {
        if (p) {
          this.page.set(1);
          this.movementsSvc
            .loadByProduct(p.id, this.page(), this.pageSize())
            .subscribe({ error: () => {} });
        } else {
          this.movementsSvc.clear();
        }
      });
    });
  }

  protected selectProduct(p: ProductResponse): void {
    this.selectedProduct.set(p);
    this.searchTerm.set('');
  }

  protected clearSelection(): void {
    this.selectedProduct.set(null);
    this.searchTerm.set('');
  }

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const p = this.selectedProduct();
    if (!p) return;
    const newPageSize = event.rows ?? 20;
    const newPage = Math.floor((event.first ?? 0) / newPageSize) + 1;
    if (newPageSize === this.pageSize() && newPage === this.page()) return;
    this.pageSize.set(newPageSize);
    this.page.set(newPage);
    this.movementsSvc.loadByProduct(p.id, newPage, newPageSize).subscribe({ error: () => {} });
  }

  protected typeLabel(m: StockMovementResponse): string {
    return movementTypeLabel(m.type);
  }

  protected typeSeverity(
    m: StockMovementResponse,
  ): 'success' | 'danger' | 'info' | 'warn' | 'secondary' {
    return movementTypeSeverity(m.type);
  }

  protected formatDate(iso: string): string {
    return formatMovementDate(iso);
  }
}
