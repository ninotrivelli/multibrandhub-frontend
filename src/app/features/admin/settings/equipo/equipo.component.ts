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
import { AlertTriangle, Pencil, Plus, KeyRound, UserMinus, UserCheck } from 'lucide-angular';
import { LucideAngularModule } from 'lucide-angular';

import { UserRole } from '../../../../core/auth/auth.types';
import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { UsersService } from './users.service';
import { UserResponse } from './users.types';
import { UserFormDialogComponent } from './user-form-dialog/user-form-dialog.component';
import {
  ResetPasswordDialogComponent,
  ResetPasswordTarget,
} from '../../../../shared/components/reset-password-dialog/reset-password-dialog.component';

interface RoleFilterOption {
  label: string;
  value: UserRole;
}

const ROLE_LABELS: Record<UserRole, string> = {
  SuperAdmin: 'Super Admin',
  Admin: 'Administrador',
  BrandManager: 'Marca',
  Seller: 'Vendedor/a',
};

const ROLE_SEVERITY: Record<UserRole, 'info' | 'success' | 'warn' | 'secondary'> = {
  SuperAdmin: 'warn',
  Admin: 'info',
  BrandManager: 'success',
  Seller: 'secondary',
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
    ResetPasswordDialogComponent,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equipo.component.html',
})
export class AdminEquipoComponent implements OnInit {
  private readonly users = inject(UsersService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly auth = inject(AuthService);

  protected readonly currentUser = this.auth.user;

  protected readonly icons = { Pencil, Plus, KeyRound, UserMinus, UserCheck, AlertTriangle };

  // SuperAdmin is hidden from the list, so it's not a filterable role.
  protected readonly roleOptions: RoleFilterOption[] = [
    { label: 'Administrador', value: 'Admin' },
    { label: 'Marca', value: 'BrandManager' },
    { label: 'Vendedor/a', value: 'Seller' },
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
      },
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
      isSelf: this.isSelf(user),
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
      acceptLabel: 'Sí, desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deactivate(user),
    });
  }

  private deactivate(user: UserResponse): void {
    this.users.deactivate(user.id).subscribe({
      next: () => this.notifications.success(`Se desactivó a ${user.fullName}.`),
      error: (_err: HttpErrorResponse) => {
        // error.interceptor already shows a toast
      },
    });
  }

  protected reactivate(user: UserResponse): void {
    this.users
      .update(user.id, {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: true,
        brandId: user.brandId,
      })
      .subscribe({
        next: () => this.notifications.success(`Se reactivó a ${user.fullName}.`),
        error: () => {
          // error.interceptor already shows a toast
        },
      });
  }
}
