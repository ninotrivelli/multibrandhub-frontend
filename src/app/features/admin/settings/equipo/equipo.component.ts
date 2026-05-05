import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ConfirmationService } from 'primeng/api';
import { Pencil, Plus, KeyRound, UserMinus, UserCheck } from 'lucide-angular';
import { LucideAngularModule } from 'lucide-angular';

import { UserRole } from '../../../../core/auth/auth.types';
import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { UsersService } from './users.service';
import { UserResponse } from './users.types';
import { UserFormDialogComponent } from './user-form-dialog/user-form-dialog.component';
import {
  ResetPasswordDialogComponent,
  ResetPasswordTarget
} from '../../../../shared/components/reset-password-dialog/reset-password-dialog.component';

interface RoleFilterOption {
  label: string;
  value: UserRole;
}

const ROLE_LABELS: Record<UserRole, string> = {
  SuperAdmin: 'Super Admin',
  Admin: 'Administrador',
  BrandManager: 'Marca',
  Seller: 'Vendedor/a'
};

const ROLE_SEVERITY: Record<UserRole, 'info' | 'success' | 'warn' | 'secondary'> = {
  SuperAdmin: 'warn',
  Admin: 'info',
  BrandManager: 'success',
  Seller: 'secondary'
};

@Component({
  selector: 'app-admin-equipo',
  imports: [
    FormsModule,
    ButtonModule,
    TableModule,
    TagModule,
    AvatarModule,
    MultiSelectModule,
    InputTextModule,
    SkeletonModule,
    TooltipModule,
    ConfirmDialogModule,
    ToggleSwitchModule,
    LucideAngularModule,
    UserFormDialogComponent,
    ResetPasswordDialogComponent
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-0">Equipo</h2>
          <p class="text-sm text-surface-500 dark:text-surface-400">
            Cuentas con acceso al sistema. Filtrá por rol o buscá por nombre/email.
          </p>
        </div>
        <button
          pButton
          type="button"
          label="Nuevo Usuario"
          (click)="openCreate()"
        >
          <i-lucide [img]="icons.Plus" class="size-4 mr-2" />
        </button>
      </header>

      <div class="flex flex-col gap-3 md:flex-row md:items-center">
        <div class="flex-1 max-w-md">
          <input
            pInputText
            type="text"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
            placeholder="Buscar por nombre o email…"
            fluid
          />
        </div>
        <div class="md:w-64">
          <p-multiselect
            [options]="roleOptions"
            [ngModel]="roleFilter()"
            (ngModelChange)="roleFilter.set($event ?? [])"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los roles"
            display="chip"
            [showClear]="true"
            styleClass="w-full"
          />
        </div>
        <label class="flex items-center gap-2 cursor-pointer select-none text-sm text-surface-600 dark:text-surface-300 whitespace-nowrap">
          <p-toggleswitch
            [ngModel]="showInactive()"
            (ngModelChange)="showInactive.set($event)"
          />
          Mostrar inactivos
        </label>
      </div>

      @if (loading() && !hasItems()) {
        <div class="flex flex-col gap-2">
          @for (i of [1, 2, 3, 4]; track i) {
            <p-skeleton height="3.5rem" />
          }
        </div>
      } @else if (filteredUsers().length === 0) {
        <div class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-8 text-center">
          <p class="text-surface-500 dark:text-surface-400">
            @if (allUsers().length === 0) {
              No hay usuarios para mostrar.
            } @else {
              No hay usuarios que coincidan con el filtro.
            }
          </p>
        </div>
      } @else {
        <div class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden">
          <p-table
            [value]="filteredUsers()"
            [paginator]="filteredUsers().length > 15"
            [rows]="15"
            [rowsPerPageOptions]="[15, 30, 45]"
            dataKey="id"
            styleClass="p-datatable-sm"
            responsiveLayout="scroll"
          >
            <ng-template pTemplate="header">
              <tr>
                <th class="min-w-56">Usuario</th>
                <th class="hidden md:table-cell">Email</th>
                <th>Rol</th>
                <th class="hidden lg:table-cell">Marca</th>
                <th>Estado</th>
                <th class="w-28 text-right">Acciones</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-user>
              <tr>
                <td>
                  <div class="flex items-center gap-3">
                    <p-avatar
                      [label]="initialsOf(user.fullName)"
                      shape="circle"
                      styleClass="bg-primary text-primary-contrast"
                    />
                    <div class="flex flex-col">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-medium text-surface-900 dark:text-surface-0">
                          {{ user.fullName }}
                        </span>
                        @if (isSelf(user)) {
                          <p-tag
                            value="(Tu Usuario)"
                            severity="info"
                            styleClass="!text-xs !font-semibold !px-2 !py-1"
                          />
                        }
                      </div>
                      <span class="text-xs text-surface-500 dark:text-surface-400 md:hidden">
                        {{ user.email }}
                      </span>
                    </div>
                  </div>
                </td>
                <td class="hidden md:table-cell">
                  <span class="text-sm text-surface-700 dark:text-surface-200">{{ user.email }}</span>
                </td>
                <td>
                  <p-tag
                    [value]="roleLabel(user.role)"
                    [severity]="roleSeverity(user.role)"
                  />
                </td>
                <td class="hidden lg:table-cell">
                  <span class="text-sm text-surface-700 dark:text-surface-200">
                    {{ user.brandName ?? '—' }}
                  </span>
                </td>
                <td>
                  <p-tag
                    [value]="user.isActive ? 'Activa' : 'Inactiva'"
                    [severity]="user.isActive ? 'success' : 'danger'"
                  />
                </td>
                <td class="w-28 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      pButton
                      type="button"
                      severity="secondary"
                      [text]="true"
                      [rounded]="true"
                      [disabled]="!canEdit(user)"
                      [pTooltip]="canEdit(user) ? 'Editar' : 'No podés editar a otro Administrador'"
                      tooltipPosition="top"
                      (click)="canEdit(user) && openEdit(user)"
                    >
                      <i-lucide [img]="icons.Pencil" class="size-4" />
                    </button>
                    <button
                      pButton
                      type="button"
                      severity="secondary"
                      [text]="true"
                      [rounded]="true"
                      [disabled]="!canResetPassword(user)"
                      [pTooltip]="canResetPassword(user) ? (isSelf(user) ? 'Resetear mi contraseña' : 'Resetear contraseña') : 'No podés cambiar la contraseña de otro Administrador'"
                      tooltipPosition="top"
                      (click)="canResetPassword(user) && openResetPassword(user)"
                    >
                      <i-lucide [img]="icons.KeyRound" class="size-4" />
                    </button>
                    @if (user.isActive) {
                      <button
                        pButton
                        type="button"
                        severity="danger"
                        [text]="true"
                        [rounded]="true"
                        [disabled]="!canDeactivate(user)"
                        [pTooltip]="isSelf(user) ? 'No podés desactivarte a vos mismo' : (canDeactivate(user) ? 'Desactivar' : 'No podés desactivar a otro Administrador')"
                        tooltipPosition="top"
                        (click)="canDeactivate(user) && confirmDeactivate(user)"
                      >
                        <i-lucide [img]="icons.UserMinus" class="size-4" />
                      </button>
                    } @else {
                      <button
                        pButton
                        type="button"
                        severity="success"
                        [text]="true"
                        [rounded]="true"
                        [disabled]="!canDeactivate(user)"
                        [pTooltip]="isSelf(user) ? 'No podés reactivarte a vos mismo' : (canDeactivate(user) ? 'Reactivar' : 'No podés reactivar a otro Administrador')"
                        tooltipPosition="top"
                        (click)="canDeactivate(user) && reactivate(user)"
                      >
                        <i-lucide [img]="icons.UserCheck" class="size-4" />
                      </button>
                    }
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      }
    </div>

    <app-user-form-dialog
      [visible]="dialogVisible()"
      [mode]="dialogMode()"
      [editing]="dialogEditing()"
      (visibleChange)="onDialogVisibleChange($event)"
      (saved)="onSaved()"
      (deleted)="onDeleted()"
    />

    <app-reset-password-dialog
      [visible]="resetDialogVisible()"
      [target]="resetTarget()"
      (visibleChange)="onResetVisibleChange($event)"
    />

    <p-confirmdialog />
  `
})
export class AdminEquipoComponent implements OnInit {
  private readonly users = inject(UsersService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly auth = inject(AuthService);

  protected readonly currentUser = this.auth.user;

  protected readonly icons = { Pencil, Plus, KeyRound, UserMinus, UserCheck };

  // SuperAdmin is hidden from the list, so it's not a filterable role.
  protected readonly roleOptions: RoleFilterOption[] = [
    { label: 'Administrador', value: 'Admin' },
    { label: 'Marca', value: 'BrandManager' },
    { label: 'Vendedor/a', value: 'Seller' }
  ];

  protected readonly searchTerm = signal('');
  protected readonly roleFilter = signal<UserRole[]>([]);
  protected readonly showInactive = signal(false);

  protected readonly allUsers = this.users.items;
  protected readonly loading = this.users.loading;
  protected readonly hasItems = this.users.hasItems;

  protected readonly filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const roles = this.roleFilter();
    const showInactive = this.showInactive();
    const selfId = this.currentUser()?.userId;
    const filtered = this.allUsers().filter((u) => {
      if (u.role === 'SuperAdmin') return false; // private service role: never list
      if (!showInactive && !u.isActive) return false;
      if (roles.length > 0 && !roles.includes(u.role)) return false;
      if (term && !`${u.fullName} ${u.email}`.toLowerCase().includes(term)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (a.id === selfId) return -1;
      if (b.id === selfId) return 1;
      return 0;
    });
  });

  protected readonly dialogVisible = signal(false);
  protected readonly dialogMode = signal<'create' | 'edit'>('create');
  protected readonly dialogEditing = signal<UserResponse | null>(null);

  protected readonly resetDialogVisible = signal(false);
  protected readonly resetTarget = signal<ResetPasswordTarget | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    this.users.list({ page: 1, pageSize: 100 }).subscribe({
      error: () => {
        // error.interceptor already shows a toast
      }
    });
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

  protected roleLabel(role: UserRole): string {
    return ROLE_LABELS[role];
  }

  protected roleSeverity(role: UserRole): 'info' | 'success' | 'warn' | 'secondary' {
    return ROLE_SEVERITY[role];
  }

  protected openCreate(): void {
    this.dialogMode.set('create');
    this.dialogEditing.set(null);
    this.dialogVisible.set(true);
  }

  protected openEdit(user: UserResponse): void {
    this.dialogMode.set('edit');
    this.dialogEditing.set(user);
    this.dialogVisible.set(true);
  }

  protected onDialogVisibleChange(value: boolean): void {
    this.dialogVisible.set(value);
  }

  protected isSelf(target: UserResponse): boolean {
    return this.currentUser()?.userId === target.id;
  }

  protected canResetPassword(target: UserResponse): boolean {
    const me = this.currentUser();
    if (!me) return false;
    if (target.id === me.userId) return true;
    return this.canEdit(target);
  }

  protected canEdit(target: UserResponse): boolean {
    const me = this.currentUser();
    if (!me) return false;
    if (target.id === me.userId) return true;
    if (me.role === 'SuperAdmin') return true;
    if (me.role === 'Admin') {
      return target.role !== 'Admin' && target.role !== 'SuperAdmin';
    }
    return false;
  }

  protected canDeactivate(target: UserResponse): boolean {
    if (this.isSelf(target)) return false;
    return this.canEdit(target);
  }

  protected openResetPassword(user: UserResponse): void {
    this.resetTarget.set({
      id: user.id,
      fullName: user.fullName,
      isSelf: this.isSelf(user)
    });
    this.resetDialogVisible.set(true);
  }

  protected onResetVisibleChange(value: boolean): void {
    this.resetDialogVisible.set(value);
  }

  protected onSaved(): void {
    // The service already updates the local list optimistically
  }

  protected onDeleted(): void {
    this.dialogVisible.set(false);
  }

  protected confirmDeactivate(user: UserResponse): void {
    this.confirmation.confirm({
      header: 'Desactivar usuario',
      message: `¿Desactivar a ${user.fullName}? No podrá iniciar sesión hasta que lo reactives.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deactivate(user)
    });
  }

  private deactivate(user: UserResponse): void {
    this.users.deactivate(user.id).subscribe({
      next: () => this.notifications.success(`Se desactivó a ${user.fullName}.`),
      error: (_err: HttpErrorResponse) => {
        // error.interceptor already shows a toast
      }
    });
  }

  protected reactivate(user: UserResponse): void {
    this.users
      .update(user.id, {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: true,
        brandId: user.brandId
      })
      .subscribe({
        next: () => this.notifications.success(`Se reactivó a ${user.fullName}.`),
        error: () => {
          // error.interceptor already shows a toast
        }
      });
  }
}
