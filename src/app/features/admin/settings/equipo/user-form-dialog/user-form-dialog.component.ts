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
import { UsersService } from '../users.service';
import { CreateUserRequest, UpdateUserRequest, UserResponse } from '../users.types';
import { BrandsService } from '../../marcas/brands.service';
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
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [closable]="!submitting()"
      [closeOnEscape]="!submitting()"
      [dismissableMask]="!submitting()"
      [draggable]="false"
      [style]="{ width: '36rem', maxWidth: '95vw' }"
      [header]="mode() === 'create' ? 'Nuevo Usuario' : 'Editar Usuario'"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="fullName" class="text-sm font-medium text-surface-700 dark:text-surface-200">
            Nombre completo
          </label>
          <input
            pInputText
            id="fullName"
            type="text"
            formControlName="fullName"
            [invalid]="isInvalid('fullName')"
            placeholder="Ej: María Pérez"
            fluid
          />
          @if (isInvalid('fullName')) {
            <p-message severity="error" size="small" variant="simple">
              El nombre es obligatorio.
            </p-message>
          }
        </div>

        <div class="flex flex-col gap-1">
          <label for="email" class="text-sm font-medium text-surface-700 dark:text-surface-200">
            Correo electrónico
          </label>
          <input
            pInputText
            id="email"
            type="email"
            formControlName="email"
            autocomplete="off"
            [invalid]="isInvalid('email')"
            placeholder="usuario@correo.com"
            fluid
          />
          @if (isInvalid('email')) {
            @if (form.controls.email.hasError('required')) {
              <p-message severity="error" size="small" variant="simple"
                >El email es obligatorio.</p-message
              >
            } @else if (form.controls.email.hasError('email')) {
              <p-message severity="error" size="small" variant="simple"
                >Ingresá un email válido.</p-message
              >
            }
          }
        </div>

        @if (mode() === 'create') {
          <div class="flex flex-col gap-1">
            <label
              for="password"
              class="text-sm font-medium text-surface-700 dark:text-surface-200"
            >
              Contraseña
            </label>
            <p-password
              inputId="password"
              formControlName="password"
              [feedback]="true"
              [toggleMask]="true"
              autocomplete="new-password"
              [invalid]="isInvalid('password')"
              fluid
            />
            @if (isInvalid('password')) {
              @if (form.controls.password.hasError('required')) {
                <p-message severity="error" size="small" variant="simple"
                  >La contraseña es obligatoria.</p-message
                >
              } @else if (form.controls.password.hasError('minlength')) {
                <p-message severity="error" size="small" variant="simple"
                  >Debe tener al menos 8 caracteres.</p-message
                >
              }
            }
          </div>

          <div class="flex flex-col gap-1">
            <label
              for="confirmPassword"
              class="text-sm font-medium text-surface-700 dark:text-surface-200"
            >
              Confirmar contraseña
            </label>
            <p-password
              inputId="confirmPassword"
              formControlName="confirmPassword"
              [feedback]="false"
              [toggleMask]="true"
              autocomplete="new-password"
              [invalid]="isInvalid('confirmPassword')"
              fluid
            />
            @if (isInvalid('confirmPassword')) {
              @if (form.controls.confirmPassword.hasError('required')) {
                <p-message severity="error" size="small" variant="simple"
                  >Repetí la contraseña.</p-message
                >
              } @else if (form.controls.confirmPassword.hasError('mismatch')) {
                <p-message severity="error" size="small" variant="simple"
                  >Las contraseñas no coinciden.</p-message
                >
              }
            }
          </div>
        }

        <div class="flex flex-col gap-1">
          <label for="role" class="text-sm font-medium text-surface-700 dark:text-surface-200">
            Rol
          </label>
          <p-select
            inputId="role"
            formControlName="role"
            [options]="roleOptions()"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleccioná un rol"
            [invalid]="isInvalid('role')"
            appendTo="body"
            fluid
          />
          @if (isInvalid('role')) {
            <p-message severity="error" size="small" variant="simple">Elegí un rol.</p-message>
          }
        </div>

        @if (showBrandSelector()) {
          <div class="flex flex-col gap-1">
            <label for="brandId" class="text-sm font-medium text-surface-700 dark:text-surface-200">
              {{
                selectedRole() === 'Admin' ? 'Marca asociada (si corresponde)' : 'Marca asociada'
              }}
            </label>
            <p-select
              inputId="brandId"
              formControlName="brandId"
              [options]="brandOptions()"
              optionLabel="label"
              optionValue="value"
              [placeholder]="selectedRole() === 'Admin' ? 'Ninguna' : 'Seleccioná una marca'"
              [invalid]="isInvalid('brandId')"
              appendTo="body"
              fluid
            />
            @if (brandSelectorLocked()) {
              <p-message severity="info" size="small" variant="simple">
                Para cambiar tu marca hace falta un endpoint que emita una sesión actualizada.
              </p-message>
            } @else if (isInvalid('brandId')) {
              <p-message severity="error" size="small" variant="simple">Elegí una marca.</p-message>
            }
          </div>
        }

        @if (mode() === 'edit') {
          <div
            class="flex items-center justify-between border border-surface-200 dark:border-surface-700 rounded-lg p-3"
          >
            <div>
              <div class="text-sm font-medium text-surface-700 dark:text-surface-200">
                Cuenta activa
              </div>
              <div class="text-xs text-surface-500 dark:text-surface-400">
                Si está inactiva, no podrá iniciar sesión.
              </div>
            </div>
            <p-toggleswitch formControlName="isActive" />
          </div>
        }

        @if (submitError()) {
          <p-message severity="error" variant="outlined" closable="false">{{
            submitError()
          }}</p-message>
        }

        <div class="flex justify-end gap-2 pt-2">
          <button
            pButton
            type="button"
            severity="secondary"
            [text]="true"
            label="Cancelar"
            [disabled]="submitting()"
            (click)="cancel()"
          ></button>
          <button
            pButton
            type="submit"
            label="Guardar"
            [loading]="submitting()"
            [disabled]="submitting()"
          ></button>
        </div>

        @if (mode() === 'edit' && !isEditingSelf()) {
          <div class="border-t border-surface-200 dark:border-surface-700 pt-4 mt-1">
            @if (!showDeleteConfirm()) {
              <button
                pButton
                type="button"
                severity="danger"
                [text]="true"
                size="small"
                label="Eliminar usuario"
                [disabled]="submitting()"
                (click)="requestDelete()"
              ></button>
            } @else {
              <div
                class="flex flex-col gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4"
              >
                <p class="text-sm font-medium text-red-700 dark:text-red-300">
                  Esta acción es permanente y no se puede deshacer.
                </p>
                <p class="text-sm text-red-600 dark:text-red-400">
                  Escribí el email <strong>{{ editing()?.email }}</strong> para confirmar.
                </p>
                <input
                  pInputText
                  type="email"
                  [value]="deleteEmailInput()"
                  (input)="deleteEmailInput.set($any($event.target).value)"
                  placeholder="Email del usuario"
                  fluid
                />
                <div class="flex justify-end gap-2">
                  <button
                    pButton
                    type="button"
                    severity="secondary"
                    [text]="true"
                    size="small"
                    label="Cancelar"
                    [disabled]="deleting()"
                    (click)="cancelDelete()"
                  ></button>
                  <button
                    pButton
                    type="button"
                    severity="danger"
                    size="small"
                    label="Eliminar definitivamente"
                    [loading]="deleting()"
                    [disabled]="!canConfirmDelete() || deleting()"
                    (click)="confirmDelete()"
                  ></button>
                </div>
              </div>
            }
          </div>
        }
      </form>
    </p-dialog>
  `,
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
