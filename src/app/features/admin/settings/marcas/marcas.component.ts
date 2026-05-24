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
import { UsersService } from '../../../../core/users/users.service';
import { UserResponse } from '../../../../core/users/users.types';
import {
  UserFormDialogComponent,
  UserFormDialogDefaults,
} from '../equipo/user-form-dialog/user-form-dialog.component';
import { hasAssociatedActiveUser, sortBrandsForUser } from './brand-settings.utils';
import { BrandFormDialogComponent } from './brand-form-dialog/brand-form-dialog.component';
import { BrandsService } from '../../../../core/brands/brands.service';
import { BrandResponse, ContractType } from '../../../../core/brands/brands.types';

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
  templateUrl: './marcas.component.html',
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
