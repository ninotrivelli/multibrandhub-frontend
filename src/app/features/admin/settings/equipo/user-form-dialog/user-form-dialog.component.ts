import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageModule } from 'primeng/message';

import { UserRole } from '../../../../../core/auth/auth.types';
import { AuthService } from '../../../../../core/auth/auth.service';
import { NotificationService } from '../../../../../core/notifications/notification.service';
import { UsersService } from '../../../../../core/users/users.service';
import { CreateUserRequest, UpdateUserRequest, UserResponse } from '../../../../../core/users/users.types';
import { BrandsService } from '../../../../../core/brands/brands.service';
import { sortBrandsForUser } from '../../marcas/brand-settings.utils';
import {
  isBrandRequiredForRole,
  resolveBrandIdForUserRole,
  shouldShowBrandSelector,
} from './user-form-dialog.utils';

type DialogMode = 'create' | 'edit';
type UserControlName = 'fullName' | 'email' | 'password' | 'confirmPassword' | 'role' | 'brandId';

interface RoleOption {
  label: string;
  value: UserRole;
}

interface BrandOption {
  label: string;
  value: string | null;
}

export interface UserFormDialogDefaults {
  role: UserRole;
  brandId: string | null;
}

const ROLE_LABELS: Record<UserRole, string> = {
  SuperAdmin: 'Super Admin',
  Admin: 'Administrador',
  BrandManager: 'Marca',
  Seller: 'Vendedor/a',
};

const passwordsMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const passwordCtrl = group.get('password');
  const confirmCtrl = group.get('confirmPassword');
  if (!passwordCtrl || !confirmCtrl) return null;

  if (passwordCtrl.disabled || confirmCtrl.disabled) {
    clearControlError(confirmCtrl, 'mismatch');
    return null;
  }

  const password = passwordCtrl.value as string | undefined;
  const confirmPassword = confirmCtrl.value as string | undefined;

  if (!password || !confirmPassword) {
    clearControlError(confirmCtrl, 'mismatch');
    return null;
  }

  if (password !== confirmPassword) {
    confirmCtrl.setErrors({ ...(confirmCtrl.errors ?? {}), mismatch: true });
    return { mismatch: true };
  }

  clearControlError(confirmCtrl, 'mismatch');
  return null;
};

function clearControlError(control: AbstractControl, errorKey: string): void {
  if (!control.hasError(errorKey)) return;
  const { [errorKey]: _omitted, ...rest } = control.errors ?? {};
  control.setErrors(Object.keys(rest).length ? rest : null);
}

@Component({
  selector: 'app-user-form-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    PasswordModule,
    SelectModule,
    ToggleSwitchModule,
    MessageModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-form-dialog.component.html',
})
export class UserFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly users = inject(UsersService);
  private readonly brands = inject(BrandsService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = input.required<boolean>();
  readonly mode = input.required<DialogMode>();
  readonly editing = input<UserResponse | null>(null);
  readonly defaults = input<UserFormDialogDefaults | null>(null);

  readonly visibleChange = output<boolean>();
  readonly saved = output<UserResponse>();
  readonly deleted = output<void>();

  // Caller-scoped role options.
  //   - SuperAdmin can create/promote Admins; SuperAdmin itself is not
  //     promotable from the UI (private service role, seeded only).
  //   - Admin can create Sellers and BrandManagers, but not Admins.
  protected readonly roleOptions = computed<RoleOption[]>(() => {
    const callerRole = this.auth.user()?.role;
    let options: RoleOption[] = [];
    if (callerRole === 'SuperAdmin') {
      options = [
        { label: 'Administrador', value: 'Admin' },
        { label: 'Marca', value: 'BrandManager' },
        { label: 'Vendedor/a', value: 'Seller' },
      ];
    } else if (callerRole === 'Admin') {
      options = [
        { label: 'Marca', value: 'BrandManager' },
        { label: 'Vendedor/a', value: 'Seller' },
      ];
    }

    const editingRole = this.editing()?.role;
    if (editingRole && !options.some((option) => option.value === editingRole)) {
      options = [...options, { label: ROLE_LABELS[editingRole], value: editingRole }];
    }

    return options;
  });

  protected readonly brandOptions = computed<BrandOption[]>(() => {
    const options = sortBrandsForUser(this.brands.items(), this.auth.user()?.brandId ?? null).map(
      (brand) => ({
        label: `${brand.name} (${brand.code})`,
        value: brand.id,
      }),
    );

    return this.selectedRole() === 'Admin'
      ? [{ label: 'Ninguna', value: null }, ...options]
      : options;
  });

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly showDeleteConfirm = signal(false);
  protected readonly deleteEmailInput = signal('');
  protected readonly deleting = signal(false);
  protected readonly canConfirmDelete = computed(
    () =>
      this.deleteEmailInput().trim().toLowerCase() === (this.editing()?.email ?? '').toLowerCase(),
  );

  protected readonly form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      role: ['Seller' as UserRole, [Validators.required]],
      brandId: this.fb.control<string | null>(null),
      isActive: [true],
    },
    { validators: passwordsMatchValidator },
  );

  protected readonly selectedRole = signal<UserRole>('Seller');
  protected readonly showBrandSelector = computed(() =>
    shouldShowBrandSelector(this.selectedRole()),
  );
  protected readonly brandSelectorLocked = computed(
    () => this.mode() === 'edit' && this.isEditingSelf() && this.showBrandSelector(),
  );
  protected readonly isCreateMode = computed(() => this.mode() === 'create');
  protected readonly isEditingSelf = computed(
    () => this.auth.user()?.userId === this.editing()?.id,
  );

  constructor() {
    this.form.controls.role.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((role) => {
        this.selectedRole.set(role);
        this.syncBrandControlState();
      });

    effect(() => {
      const open = this.visible();
      if (open) {
        untracked(() => {
          this.ensureBrandsLoaded();
          this.resetFormFromInputs();
        });
      }
    });
  }

  protected isInvalid(controlName: UserControlName): boolean {
    const c = this.form.controls[controlName];
    return c.invalid && (c.touched || c.dirty);
  }

  protected onVisibleChange(value: boolean): void {
    if (!value && this.submitting()) return;
    this.visibleChange.emit(value);
  }

  protected cancel(): void {
    this.visibleChange.emit(false);
  }

  protected submit(): void {
    if (this.submitting()) return;

    const passwordCtrl = this.form.controls.password;
    const confirmPasswordCtrl = this.form.controls.confirmPassword;
    if (this.mode() === 'create') {
      passwordCtrl.enable({ emitEvent: false });
      confirmPasswordCtrl.enable({ emitEvent: false });
    } else {
      passwordCtrl.disable({ emitEvent: false });
      confirmPasswordCtrl.disable({ emitEvent: false });
    }
    this.syncBrandControlState();
    this.form.updateValueAndValidity({ emitEvent: false });

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);

    const raw = this.form.getRawValue();
    const editingUser = this.editing();

    if (this.mode() === 'create') {
      const payload: CreateUserRequest = {
        fullName: raw.fullName.trim(),
        email: raw.email.trim(),
        password: raw.password,
        role: raw.role,
        brandId: resolveBrandIdForUserRole(raw.role, raw.brandId),
      };
      this.users.create(payload).subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.notifications.success(`Se creó ${created.fullName}.`);
          this.saved.emit(created);
          this.visibleChange.emit(false);
        },
        error: (err: HttpErrorResponse) => this.handleError(err),
      });
    } else if (editingUser) {
      const payload: UpdateUserRequest = {
        fullName: raw.fullName.trim(),
        email: raw.email.trim(),
        role: raw.role,
        isActive: raw.isActive,
        brandId: resolveBrandIdForUserRole(raw.role, raw.brandId),
      };
      this.users.update(editingUser.id, payload).subscribe({
        next: (updated) => {
          this.submitting.set(false);
          this.notifications.success(`Se actualizó ${updated.fullName}.`);
          this.saved.emit(updated);
          this.visibleChange.emit(false);
        },
        error: (err: HttpErrorResponse) => this.handleError(err),
      });
    }
  }

  protected requestDelete(): void {
    this.showDeleteConfirm.set(true);
    this.deleteEmailInput.set('');
  }

  protected cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.deleteEmailInput.set('');
  }

  protected confirmDelete(): void {
    const user = this.editing();
    if (!user || !this.canConfirmDelete() || this.deleting()) return;

    this.deleting.set(true);
    this.users.delete(user.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.notifications.success(`Se eliminó a ${user.fullName}.`);
        this.deleted.emit();
        this.visibleChange.emit(false);
      },
      error: () => {
        this.deleting.set(false);
      },
    });
  }

  private handleError(err: HttpErrorResponse): void {
    this.submitting.set(false);
    const body = err.error as { message?: string; errors?: { message: string }[] } | undefined;
    if (body?.errors?.length) {
      this.submitError.set(body.errors.map((e) => e.message).join(' • '));
    } else if (body?.message) {
      this.submitError.set(body.message);
    } else {
      this.submitError.set('No se pudo guardar. Probá de nuevo.');
    }
  }

  private resetFormFromInputs(): void {
    this.submitError.set(null);
    this.showDeleteConfirm.set(false);
    this.deleteEmailInput.set('');
    const passwordCtrl = this.form.controls.password;
    const confirmPasswordCtrl = this.form.controls.confirmPassword;
    const roleCtrl = this.form.controls.role;
    const brandCtrl = this.form.controls.brandId;
    const isActiveCtrl = this.form.controls.isActive;
    const editingUser = this.editing();

    if (this.mode() === 'create') {
      passwordCtrl.enable({ emitEvent: false });
      confirmPasswordCtrl.enable({ emitEvent: false });
      roleCtrl.enable({ emitEvent: false });
      brandCtrl.enable({ emitEvent: false });
      isActiveCtrl.enable({ emitEvent: false });
      const defaults = this.defaults();
      const role = defaults?.role ?? 'Seller';
      this.form.reset({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role,
        brandId: defaults?.brandId ?? null,
        isActive: true,
      });
      this.selectedRole.set(role);
    } else if (editingUser) {
      passwordCtrl.disable({ emitEvent: false });
      confirmPasswordCtrl.disable({ emitEvent: false });
      const isSelf = this.auth.user()?.userId === editingUser.id;
      if (isSelf) {
        roleCtrl.disable({ emitEvent: false });
        brandCtrl.disable({ emitEvent: false });
        isActiveCtrl.disable({ emitEvent: false });
      } else {
        roleCtrl.enable({ emitEvent: false });
        brandCtrl.enable({ emitEvent: false });
        isActiveCtrl.enable({ emitEvent: false });
      }
      this.form.reset({
        fullName: editingUser.fullName,
        email: editingUser.email,
        password: '',
        confirmPassword: '',
        role: editingUser.role,
        brandId: editingUser.brandId,
        isActive: editingUser.isActive,
      });
      this.selectedRole.set(editingUser.role);
    }

    this.syncBrandControlState();
  }

  private syncBrandControlState(): void {
    const role = this.form.controls.role.getRawValue();
    const brandCtrl = this.form.controls.brandId;

    if (isBrandRequiredForRole(role)) {
      brandCtrl.setValidators([Validators.required]);
    } else {
      brandCtrl.clearValidators();
    }

    if (!shouldShowBrandSelector(role)) {
      brandCtrl.setValue(null, { emitEvent: false });
      brandCtrl.disable({ emitEvent: false });
    } else if (this.mode() === 'edit' && this.isEditingSelf()) {
      brandCtrl.disable({ emitEvent: false });
    } else {
      brandCtrl.enable({ emitEvent: false });
    }

    brandCtrl.updateValueAndValidity({ emitEvent: false });
  }

  private ensureBrandsLoaded(): void {
    if (this.brands.hasItems() || this.brands.loading()) return;
    this.brands.list({ page: 1, pageSize: 100 }).subscribe({
      error: () => {
        // error.interceptor already shows a toast
      },
    });
  }
}
