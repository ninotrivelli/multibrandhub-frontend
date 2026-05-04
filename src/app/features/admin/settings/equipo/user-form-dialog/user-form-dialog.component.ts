import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import {
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse
} from '../users.types';

type DialogMode = 'create' | 'edit';

interface RoleOption {
  label: string;
  value: UserRole;
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
    MessageModule
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
              <p-message severity="error" size="small" variant="simple">El email es obligatorio.</p-message>
            } @else if (form.controls.email.hasError('email')) {
              <p-message severity="error" size="small" variant="simple">Ingresá un email válido.</p-message>
            }
          }
        </div>

        @if (mode() === 'create') {
          <div class="flex flex-col gap-1">
            <label for="password" class="text-sm font-medium text-surface-700 dark:text-surface-200">
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
                <p-message severity="error" size="small" variant="simple">La contraseña es obligatoria.</p-message>
              } @else if (form.controls.password.hasError('minlength')) {
                <p-message severity="error" size="small" variant="simple">Debe tener al menos 8 caracteres.</p-message>
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

        @if (mode() === 'edit') {
          <div class="flex items-center justify-between border border-surface-200 dark:border-surface-700 rounded-lg p-3">
            <div>
              <div class="text-sm font-medium text-surface-700 dark:text-surface-200">Cuenta activa</div>
              <div class="text-xs text-surface-500 dark:text-surface-400">
                Si está inactiva, no podrá iniciar sesión.
              </div>
            </div>
            <p-toggleswitch formControlName="isActive" />
          </div>
        }

        @if (submitError()) {
          <p-message severity="error" variant="outlined" closable="false">{{ submitError() }}</p-message>
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
              <div class="flex flex-col gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4">
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
  `
})
export class UserFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly users = inject(UsersService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);

  readonly visible = input.required<boolean>();
  readonly mode = input.required<DialogMode>();
  readonly editing = input<UserResponse | null>(null);

  readonly visibleChange = output<boolean>();
  readonly saved = output<UserResponse>();
  readonly deleted = output<void>();

  // Caller-scoped role options.
  //   - SuperAdmin can create/promote Admins; SuperAdmin itself is not
  //     promotable from the UI (private service role, seeded only).
  //   - Admin can only create Sellers. BrandManager creation is deferred
  //     to the Marcas module (needs a brand selector).
  protected readonly roleOptions = computed<RoleOption[]>(() => {
    const callerRole = this.auth.user()?.role;
    if (callerRole === 'SuperAdmin') {
      return [
        { label: 'Administrador', value: 'Admin' },
        { label: 'Vendedor/a', value: 'Seller' }
      ];
    }
    if (callerRole === 'Admin') {
      return [{ label: 'Vendedor/a', value: 'Seller' }];
    }
    return [];
  });

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly showDeleteConfirm = signal(false);
  protected readonly deleteEmailInput = signal('');
  protected readonly deleting = signal(false);
  protected readonly canConfirmDelete = computed(
    () => this.deleteEmailInput().trim().toLowerCase() === (this.editing()?.email ?? '').toLowerCase()
  );

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['Seller' as UserRole, [Validators.required]],
    isActive: [true]
  });

  protected readonly isCreateMode = computed(() => this.mode() === 'create');
  protected readonly isEditingSelf = computed(
    () => this.auth.user()?.userId === this.editing()?.id
  );

  constructor() {
    effect(() => {
      const open = this.visible();
      if (open) untracked(() => this.resetFormFromInputs());
    });
  }

  protected isInvalid(controlName: 'fullName' | 'email' | 'password' | 'role'): boolean {
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
    if (this.mode() === 'create') {
      passwordCtrl.enable({ emitEvent: false });
    } else {
      passwordCtrl.disable({ emitEvent: false });
    }

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
        brandId: null
      };
      this.users.create(payload).subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.notifications.success(`Se creó ${created.fullName}.`);
          this.saved.emit(created);
          this.visibleChange.emit(false);
        },
        error: (err: HttpErrorResponse) => this.handleError(err)
      });
    } else if (editingUser) {
      const payload: UpdateUserRequest = {
        fullName: raw.fullName.trim(),
        email: raw.email.trim(),
        role: raw.role,
        isActive: raw.isActive,
        brandId: editingUser.brandId
      };
      this.users.update(editingUser.id, payload).subscribe({
        next: (updated) => {
          this.submitting.set(false);
          this.notifications.success(`Se actualizó ${updated.fullName}.`);
          this.saved.emit(updated);
          this.visibleChange.emit(false);
        },
        error: (err: HttpErrorResponse) => this.handleError(err)
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
      }
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
    const roleCtrl = this.form.controls.role;
    const isActiveCtrl = this.form.controls.isActive;
    const editingUser = this.editing();

    if (this.mode() === 'create') {
      passwordCtrl.enable({ emitEvent: false });
      roleCtrl.enable({ emitEvent: false });
      isActiveCtrl.enable({ emitEvent: false });
      this.form.reset({
        fullName: '',
        email: '',
        password: '',
        role: 'Seller',
        isActive: true
      });
    } else if (editingUser) {
      passwordCtrl.disable({ emitEvent: false });
      const isSelf = this.auth.user()?.userId === editingUser.id;
      if (isSelf) {
        roleCtrl.disable({ emitEvent: false });
        isActiveCtrl.disable({ emitEvent: false });
      } else {
        roleCtrl.enable({ emitEvent: false });
        isActiveCtrl.enable({ emitEvent: false });
      }
      this.form.reset({
        fullName: editingUser.fullName,
        email: editingUser.email,
        password: '',
        role: editingUser.role,
        isActive: editingUser.isActive
      });
    }
  }
}
