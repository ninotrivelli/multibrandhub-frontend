import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { Archive, LucideAngularModule, Pencil, Plus, Trash2, UserPlus } from 'lucide-angular';

import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { UsersService } from '../equipo/users.service';
import { UserResponse } from '../equipo/users.types';
import {
  UserFormDialogComponent,
  UserFormDialogDefaults,
} from '../equipo/user-form-dialog/user-form-dialog.component';
import { hasAssociatedActiveUser, sortBrandsForUser } from './brand-settings.utils';
import { BrandFormDialogComponent } from './brand-form-dialog/brand-form-dialog.component';
import { BrandsService } from './brands.service';
import { BrandResponse, ContractType } from './brands.types';

const CONTRACT_LABELS: Record<ContractType, string> = {
  CommissionOnly: 'Solo comisión',
  FixedRent: 'Alquiler fijo',
  Hybrid: 'Mixto',
};

const CONTRACT_SEVERITY: Record<ContractType, 'info' | 'success' | 'warn'> = {
  CommissionOnly: 'info',
  FixedRent: 'warn',
  Hybrid: 'success',
};

@Component({
  selector: 'app-admin-marcas',
  imports: [
    FormsModule,
    AvatarModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
    TooltipModule,
    LucideAngularModule,
    BrandFormDialogComponent,
    UserFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-0">
            Marcas Asociadas
          </h2>
          <p class="text-sm text-surface-500 dark:text-surface-400">
            Gestioná las marcas, sus acuerdos comerciales y el acceso de cada cuenta Marca.
          </p>
        </div>
        <div class="flex flex-col gap-3 md:flex-row md:items-center">
          <label
            class="flex items-center gap-2 cursor-pointer select-none text-sm text-surface-600 dark:text-surface-300 whitespace-nowrap"
          >
            <p-toggleswitch
              [ngModel]="showArchived()"
              (ngModelChange)="onShowArchivedChange($event)"
            />
            Mostrar dadas de baja
          </label>
          <button pButton type="button" label="Nueva Marca" (click)="openCreateBrand()">
            <i-lucide [img]="icons.Plus" class="size-4 mr-2" />
          </button>
        </div>
      </header>

      @if (loading() && !hasBrands()) {
        <div class="flex flex-col gap-2">
          @for (i of [1, 2, 3, 4]; track i) {
            <p-skeleton height="4.75rem" />
          }
        </div>
      } @else if (orderedBrands().length === 0) {
        <div
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-8 text-center"
        >
          <p class="text-surface-500 dark:text-surface-400">
            @if (showArchived()) {
              No hay marcas para mostrar.
            } @else {
              Todavía no hay marcas activas. Activá "Mostrar dadas de baja" si querés ver el
              historial.
            }
          </p>
        </div>
      } @else {
        <div
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden"
        >
          <p-table
            [value]="orderedBrands()"
            [paginator]="orderedBrands().length > 12"
            [rows]="12"
            [rowsPerPageOptions]="[12, 24, 48]"
            dataKey="id"
            styleClass="p-datatable-sm"
            responsiveLayout="scroll"
          >
            <ng-template pTemplate="header">
              <tr>
                <th class="min-w-72">Marca</th>
                <th class="hidden md:table-cell">Contacto</th>
                <th class="min-w-56">Acuerdo</th>
                <th class="hidden lg:table-cell">Usuario Marca</th>
                <th class="w-44 text-right">Acciones</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-brand>
              <tr [class.opacity-60]="isArchived(brand)">
                <td>
                  <div class="flex items-center gap-3">
                    <p-avatar
                      [image]="avatarImage(brand)"
                      [label]="avatarLabel(brand)"
                      shape="circle"
                      styleClass="bg-primary text-primary-contrast"
                    />
                    <div class="flex min-w-0 flex-col gap-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-medium text-surface-900 dark:text-surface-0">
                          {{ brand.name }}
                        </span>
                        @if (isOwnBrand(brand)) {
                          <p-tag
                            value="Mi Marca"
                            severity="info"
                            styleClass="!text-xs !font-semibold !px-2 !py-1"
                          />
                        }
                        @if (isArchived(brand)) {
                          <p-tag
                            value="Dada de baja"
                            severity="secondary"
                            styleClass="!text-xs !font-semibold !px-2 !py-1"
                          />
                        } @else if (!hasAssociatedUser(brand)) {
                          <p-tag
                            value="Marca sin usuario asociado"
                            severity="danger"
                            styleClass="!text-xs !font-semibold !px-2 !py-1"
                          />
                        }
                      </div>
                      <span
                        class="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400"
                      >
                        {{ brand.code }}
                      </span>
                      <span class="text-xs text-surface-500 dark:text-surface-400 md:hidden">
                        {{ brand.contactEmail ?? 'Sin email de contacto' }}
                      </span>
                    </div>
                  </div>
                </td>
                <td class="hidden md:table-cell">
                  <span class="text-sm text-surface-700 dark:text-surface-200">
                    {{ brand.contactEmail ?? 'Sin email' }}
                  </span>
                </td>
                <td>
                  <div class="flex flex-col gap-1">
                    <div>
                      <p-tag
                        [value]="contractLabel(brand.contractType)"
                        [severity]="contractSeverity(brand.contractType)"
                      />
                    </div>
                    <span class="text-xs text-surface-500 dark:text-surface-400">
                      {{ agreementText(brand) }}
                    </span>
                  </div>
                </td>
                <td class="hidden lg:table-cell">
                  @if (primaryAssociatedUser(brand); as user) {
                    <span class="text-sm text-surface-700 dark:text-surface-200">
                      {{ user.fullName }}
                    </span>
                  } @else {
                    <span class="text-sm text-red-600 dark:text-red-300">
                      Sin usuario asociado
                    </span>
                  }
                </td>
                <td class="w-44 text-right">
                  <div class="flex items-center justify-end gap-1">
                    @if (!isArchived(brand)) {
                      @if (!hasAssociatedUser(brand)) {
                        <button
                          pButton
                          type="button"
                          severity="success"
                          [text]="true"
                          [rounded]="true"
                          pTooltip="Crear usuario Marca"
                          tooltipPosition="top"
                          (click)="openCreateBrandManager(brand)"
                        >
                          <i-lucide [img]="icons.UserPlus" class="size-4" />
                        </button>
                      }
                      <button
                        pButton
                        type="button"
                        severity="secondary"
                        [text]="true"
                        [rounded]="true"
                        pTooltip="Editar marca"
                        tooltipPosition="top"
                        (click)="openEditBrand(brand)"
                      >
                        <i-lucide [img]="icons.Pencil" class="size-4" />
                      </button>
                      <button
                        pButton
                        type="button"
                        severity="warn"
                        [text]="true"
                        [rounded]="true"
                        [disabled]="isOwnBrand(brand)"
                        [pTooltip]="
                          isOwnBrand(brand) ? 'No podés dar de baja tu marca' : 'Dar de baja marca'
                        "
                        tooltipPosition="top"
                        (click)="!isOwnBrand(brand) && openOffboardBrandDialog(brand)"
                      >
                        <i-lucide [img]="icons.Archive" class="size-4" />
                      </button>
                      @if (canHardDelete()) {
                        <button
                          pButton
                          type="button"
                          severity="danger"
                          [text]="true"
                          [rounded]="true"
                          pTooltip="Eliminar (solo marcas vacías)"
                          tooltipPosition="top"
                          (click)="openDeleteBrandDialog(brand)"
                        >
                          <i-lucide [img]="icons.Trash2" class="size-4" />
                        </button>
                      }
                    }
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      }
    </div>

    <app-brand-form-dialog
      [visible]="brandDialogVisible()"
      [mode]="brandDialogMode()"
      [editing]="brandDialogEditing()"
      (visibleChange)="brandDialogVisible.set($event)"
      (saved)="onBrandSaved()"
    />

    <app-user-form-dialog
      [visible]="userDialogVisible()"
      [mode]="'create'"
      [editing]="null"
      [defaults]="userDialogDefaults()"
      (visibleChange)="onUserDialogVisibleChange($event)"
      (saved)="onUserSaved()"
      (deleted)="onUserDeleted()"
    />

    <p-dialog
      [visible]="offboardBrandDialogVisible()"
      (visibleChange)="onOffboardBrandDialogVisibleChange($event)"
      [modal]="true"
      [closable]="!offboardingBrand()"
      [closeOnEscape]="!offboardingBrand()"
      [dismissableMask]="!offboardingBrand()"
      [draggable]="false"
      [style]="{ width: '34rem', maxWidth: '95vw' }"
      header="Dar de baja marca"
    >
      @if (offboardBrandTarget(); as brand) {
        <div class="flex flex-col gap-4">
          <div
            class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            Esta acción es seria y no se puede revertir desde la app.
          </div>

          <div class="flex flex-col gap-2 text-sm text-surface-700 dark:text-surface-200">
            <p class="font-medium text-surface-900 dark:text-surface-0">
              Qué pasa al dar de baja <strong>{{ brand.name }}</strong
              >:
            </p>
            <ul class="flex flex-col gap-2 pl-5 list-disc marker:text-surface-400">
              <li>
                La marca queda archivada. Sus productos dejan de aparecer en búsquedas e inventario,
                pero siguen existiendo para ventas viejas, devoluciones y reportes.
              </li>
              <li>
                Los usuarios asociados a la marca quedan desactivados y no van a poder iniciar
                sesión.
              </li>
              <li>
                Las ventas, devoluciones, reportes y liquidaciones históricas se conservan tal cual.
              </li>
            </ul>
          </div>

          <div class="flex flex-col gap-2 pt-2">
            <p class="text-sm text-surface-600 dark:text-surface-300">
              Para confirmar, escribí <strong>{{ brand.name }}</strong> abajo.
            </p>
            <input
              pInputText
              type="text"
              [value]="offboardBrandNameInput()"
              (input)="offboardBrandNameInput.set($any($event.target).value)"
              placeholder="Nombre de la marca"
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
              [disabled]="offboardingBrand()"
              (click)="cancelOffboardBrand()"
            ></button>
            <button
              pButton
              type="button"
              severity="warn"
              label="Dar de baja marca"
              [loading]="offboardingBrand()"
              [disabled]="!canConfirmOffboardBrand() || offboardingBrand()"
              (click)="confirmOffboardBrand()"
            ></button>
          </div>
        </div>
      }
    </p-dialog>

    <p-dialog
      [visible]="deleteBrandDialogVisible()"
      (visibleChange)="onDeleteBrandDialogVisibleChange($event)"
      [modal]="true"
      [closable]="!deletingBrand()"
      [closeOnEscape]="!deletingBrand()"
      [dismissableMask]="!deletingBrand()"
      [draggable]="false"
      [style]="{ width: '32rem', maxWidth: '95vw' }"
      header="Eliminar marca (técnico)"
    >
      @if (deleteBrandTarget(); as brand) {
        <div class="flex flex-col gap-4">
          <div
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
          >
            Solo funciona si la marca no tiene productos ni usuarios asociados. Para marcas con
            historia, usá <strong>Dar de baja</strong>.
          </div>

          <div class="flex flex-col gap-2">
            <p class="text-sm text-surface-600 dark:text-surface-300">
              Escribí <strong>{{ brand.name }}</strong> para confirmar.
            </p>
            <input
              pInputText
              type="text"
              [value]="deleteBrandNameInput()"
              (input)="deleteBrandNameInput.set($any($event.target).value)"
              placeholder="Nombre de la marca"
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
              [disabled]="deletingBrand()"
              (click)="cancelDeleteBrand()"
            ></button>
            <button
              pButton
              type="button"
              severity="danger"
              label="Eliminar definitivamente"
              [loading]="deletingBrand()"
              [disabled]="!canConfirmDeleteBrand() || deletingBrand()"
              (click)="confirmDeleteBrand()"
            ></button>
          </div>
        </div>
      }
    </p-dialog>
  `,
})
export class AdminMarcasComponent implements OnInit {
  private readonly brands = inject(BrandsService);
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  protected readonly icons = { Archive, Pencil, Plus, Trash2, UserPlus };

  protected readonly currentUser = this.auth.user;
  protected readonly allBrands = this.brands.items;
  protected readonly allUsers = this.users.items;
  protected readonly loading = computed(() => this.brands.loading() || this.users.loading());
  protected readonly hasBrands = this.brands.hasItems;

  protected readonly showArchived = signal(false);

  protected readonly orderedBrands = computed(() => {
    const sorted = sortBrandsForUser(this.allBrands(), this.currentUser()?.brandId ?? null);
    return this.showArchived() ? sorted : sorted.filter((b) => b.status === 'Active');
  });

  private readonly associatedUsersByBrand = computed(() => {
    const map = new Map<string, UserResponse[]>();
    for (const user of this.allUsers()) {
      const isAssociable = user.role === 'BrandManager' || user.role === 'Admin';
      if (!isAssociable || !user.isActive || !user.brandId) continue;
      const users = map.get(user.brandId) ?? [];
      users.push(user);
      map.set(user.brandId, users);
    }
    return map;
  });

  protected readonly canHardDelete = computed(() => this.currentUser()?.role === 'SuperAdmin');

  protected readonly brandDialogVisible = signal(false);
  protected readonly brandDialogMode = signal<'create' | 'edit'>('create');
  protected readonly brandDialogEditing = signal<BrandResponse | null>(null);

  protected readonly userDialogVisible = signal(false);
  protected readonly userDialogDefaults = signal<UserFormDialogDefaults | null>(null);

  protected readonly offboardBrandDialogVisible = signal(false);
  protected readonly offboardBrandTarget = signal<BrandResponse | null>(null);
  protected readonly offboardBrandNameInput = signal('');
  protected readonly offboardingBrand = signal(false);
  protected readonly canConfirmOffboardBrand = computed(
    () => this.offboardBrandNameInput().trim() === (this.offboardBrandTarget()?.name ?? ''),
  );

  protected readonly deleteBrandDialogVisible = signal(false);
  protected readonly deleteBrandTarget = signal<BrandResponse | null>(null);
  protected readonly deleteBrandNameInput = signal('');
  protected readonly deletingBrand = signal(false);
  protected readonly canConfirmDeleteBrand = computed(
    () => this.deleteBrandNameInput().trim() === (this.deleteBrandTarget()?.name ?? ''),
  );

  private readonly currencyFormatter = new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    maximumFractionDigits: 0,
  });

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    forkJoin({
      brands: this.brands.list({
        page: 1,
        pageSize: 100,
        includeArchived: this.showArchived(),
      }),
      users: this.users.list({ page: 1, pageSize: 100 }),
    }).subscribe({
      error: () => {
        // error.interceptor already shows a toast
      },
    });
  }

  protected onShowArchivedChange(value: boolean): void {
    this.showArchived.set(value);
    this.refresh();
  }

  protected avatarImage(brand: BrandResponse): string | undefined {
    return brand.logoUrl ?? undefined;
  }

  protected avatarLabel(brand: BrandResponse): string | undefined {
    if (brand.logoUrl) return undefined;
    return this.initialsOf(brand.name);
  }

  protected initialsOf(name: string): string {
    return (
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]!.toUpperCase())
        .join('') || '?'
    );
  }

  protected isOwnBrand(brand: BrandResponse): boolean {
    return this.currentUser()?.brandId === brand.id;
  }

  protected isArchived(brand: BrandResponse): boolean {
    return brand.status === 'Archived';
  }

  protected hasAssociatedUser(brand: BrandResponse): boolean {
    return hasAssociatedActiveUser(brand.id, this.allUsers());
  }

  protected primaryAssociatedUser(brand: BrandResponse): UserResponse | null {
    return this.associatedUsersByBrand().get(brand.id)?.[0] ?? null;
  }

  protected contractLabel(contractType: ContractType): string {
    return CONTRACT_LABELS[contractType];
  }

  protected contractSeverity(contractType: ContractType): 'info' | 'success' | 'warn' {
    return CONTRACT_SEVERITY[contractType];
  }

  protected agreementText(brand: BrandResponse): string {
    const parts: string[] = [];
    if (brand.contractType !== 'FixedRent') {
      parts.push(`${this.formatPercent(brand.commissionPercentage)} comisión`);
    }
    if (brand.contractType !== 'CommissionOnly') {
      parts.push(`${this.currencyFormatter.format(brand.fixedRentCost)} alquiler`);
    }
    return parts.join(' + ');
  }

  protected openCreateBrand(): void {
    this.brandDialogMode.set('create');
    this.brandDialogEditing.set(null);
    this.brandDialogVisible.set(true);
  }

  protected openEditBrand(brand: BrandResponse): void {
    this.brandDialogMode.set('edit');
    this.brandDialogEditing.set(brand);
    this.brandDialogVisible.set(true);
  }

  protected onBrandSaved(): void {
    // BrandsService updates the local list optimistically.
  }

  protected openCreateBrandManager(brand: BrandResponse): void {
    this.userDialogDefaults.set({ role: 'BrandManager', brandId: brand.id });
    this.userDialogVisible.set(true);
  }

  protected onUserDialogVisibleChange(value: boolean): void {
    this.userDialogVisible.set(value);
    if (!value) this.userDialogDefaults.set(null);
  }

  protected onUserSaved(): void {
    // UsersService updates the local list optimistically, so the red chip disappears.
  }

  protected onUserDeleted(): void {
    this.userDialogVisible.set(false);
    this.userDialogDefaults.set(null);
  }

  protected openOffboardBrandDialog(brand: BrandResponse): void {
    this.offboardBrandTarget.set(brand);
    this.offboardBrandNameInput.set('');
    this.offboardBrandDialogVisible.set(true);
  }

  protected onOffboardBrandDialogVisibleChange(value: boolean): void {
    if (!value && this.offboardingBrand()) return;
    this.offboardBrandDialogVisible.set(value);
    if (!value) this.resetOffboardBrandDialog();
  }

  protected cancelOffboardBrand(): void {
    if (this.offboardingBrand()) return;
    this.offboardBrandDialogVisible.set(false);
    this.resetOffboardBrandDialog();
  }

  protected confirmOffboardBrand(): void {
    const brand = this.offboardBrandTarget();
    if (!brand || !this.canConfirmOffboardBrand() || this.offboardingBrand()) return;
    this.offboardBrand(brand);
  }

  private offboardBrand(brand: BrandResponse): void {
    this.offboardingBrand.set(true);
    this.brands.offboard(brand.id).subscribe({
      next: (res) => {
        this.offboardingBrand.set(false);
        this.notifications.success(
          `Se dio de baja ${res.brandName}. Productos archivados: ${res.productsArchived}. Usuarios desactivados: ${res.usersDeactivated}.`,
        );
        this.offboardBrandDialogVisible.set(false);
        this.resetOffboardBrandDialog();
        this.refresh();
      },
      error: (_err: HttpErrorResponse) => {
        this.offboardingBrand.set(false);
        // error.interceptor already shows a toast
      },
    });
  }

  private resetOffboardBrandDialog(): void {
    this.offboardBrandTarget.set(null);
    this.offboardBrandNameInput.set('');
  }

  protected openDeleteBrandDialog(brand: BrandResponse): void {
    this.deleteBrandTarget.set(brand);
    this.deleteBrandNameInput.set('');
    this.deleteBrandDialogVisible.set(true);
  }

  protected onDeleteBrandDialogVisibleChange(value: boolean): void {
    if (!value && this.deletingBrand()) return;
    this.deleteBrandDialogVisible.set(value);
    if (!value) this.resetDeleteBrandDialog();
  }

  protected cancelDeleteBrand(): void {
    if (this.deletingBrand()) return;
    this.deleteBrandDialogVisible.set(false);
    this.resetDeleteBrandDialog();
  }

  protected confirmDeleteBrand(): void {
    const brand = this.deleteBrandTarget();
    if (!brand || !this.canConfirmDeleteBrand() || this.deletingBrand()) return;
    this.deleteBrand(brand);
  }

  private deleteBrand(brand: BrandResponse): void {
    this.deletingBrand.set(true);
    this.brands.delete(brand.id).subscribe({
      next: () => {
        this.deletingBrand.set(false);
        this.notifications.success(`Se eliminó ${brand.name}.`);
        this.deleteBrandDialogVisible.set(false);
        this.resetDeleteBrandDialog();
      },
      error: (_err: HttpErrorResponse) => {
        this.deletingBrand.set(false);
        // error.interceptor already shows a toast
      },
    });
  }

  private resetDeleteBrandDialog(): void {
    this.deleteBrandTarget.set(null);
    this.deleteBrandNameInput.set('');
  }

  private formatPercent(value: number): string {
    return `${new Intl.NumberFormat('es-UY', {
      maximumFractionDigits: 2,
    }).format(value)}%`;
  }
}
