import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { LucideAngularModule, Mail, MapPin, Pencil, Phone, Plus, Store } from 'lucide-angular';

import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { StoreProfileService } from './store-profile.service';
import { UpdateStoreProfileRequest } from './store-profile.types';

type ProfileControlName =
  | 'storeName'
  | 'address'
  | 'primaryPhone'
  | 'secondaryPhone'
  | 'contactEmail';

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

@Component({
  selector: 'app-ajustes-generales',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    SkeletonModule,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <header>
        <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-0">Ajustes Generales</h2>
        <p class="text-sm text-surface-500 dark:text-surface-400">
          Datos del local: nombre, dirección y formas de contacto.
        </p>
      </header>

      @if (showSkeleton()) {
        <div
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-6"
        >
          <div class="flex flex-col gap-3">
            <p-skeleton height="2rem" width="40%" />
            <p-skeleton height="1.25rem" width="60%" />
            <p-skeleton height="1.25rem" width="55%" />
            <p-skeleton height="1.25rem" width="50%" />
          </div>
        </div>
      } @else if (editing()) {
        <form
          [formGroup]="form"
          (ngSubmit)="submit()"
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-6 flex flex-col gap-4"
        >
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="flex flex-col gap-1 md:col-span-2">
              <label
                for="storeName"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                Nombre del local
              </label>
              <input
                pInputText
                id="storeName"
                type="text"
                formControlName="storeName"
                [invalid]="isInvalid('storeName')"
                placeholder="Ej: MultiBrandHub Centro"
                fluid
              />
              @if (isInvalid('storeName')) {
                @if (form.controls.storeName.hasError('required')) {
                  <p-message severity="error" size="small" variant="simple">
                    El nombre del local es obligatorio.
                  </p-message>
                } @else {
                  <p-message severity="error" size="small" variant="simple">
                    Máximo 200 caracteres.
                  </p-message>
                }
              }
            </div>

            <div class="flex flex-col gap-1 md:col-span-2">
              <label for="address" class="text-sm font-medium text-surface-700 dark:text-surface-200">
                Dirección
              </label>
              <input
                pInputText
                id="address"
                type="text"
                formControlName="address"
                [invalid]="isInvalid('address')"
                placeholder="Ej: Av. 18 de Julio 1234"
                fluid
              />
              @if (isInvalid('address')) {
                <p-message severity="error" size="small" variant="simple">
                  Máximo 300 caracteres.
                </p-message>
              }
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="primaryPhone"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                Teléfono principal
              </label>
              <input
                pInputText
                id="primaryPhone"
                type="tel"
                formControlName="primaryPhone"
                [invalid]="isInvalid('primaryPhone')"
                placeholder="Ej: 099 123 456"
                fluid
              />
              @if (isInvalid('primaryPhone')) {
                <p-message severity="error" size="small" variant="simple">
                  Máximo 50 caracteres.
                </p-message>
              }
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="secondaryPhone"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                Teléfono secundario
              </label>
              <input
                pInputText
                id="secondaryPhone"
                type="tel"
                formControlName="secondaryPhone"
                [invalid]="isInvalid('secondaryPhone')"
                placeholder="Opcional"
                fluid
              />
              @if (isInvalid('secondaryPhone')) {
                <p-message severity="error" size="small" variant="simple">
                  Máximo 50 caracteres.
                </p-message>
              }
            </div>

            <div class="flex flex-col gap-1 md:col-span-2">
              <label
                for="contactEmail"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                Email de contacto
              </label>
              <input
                pInputText
                id="contactEmail"
                type="email"
                formControlName="contactEmail"
                [invalid]="isInvalid('contactEmail')"
                placeholder="contacto@local.com"
                fluid
              />
              @if (isInvalid('contactEmail')) {
                @if (form.controls.contactEmail.hasError('email')) {
                  <p-message severity="error" size="small" variant="simple">
                    Ingresá un email válido.
                  </p-message>
                } @else {
                  <p-message severity="error" size="small" variant="simple">
                    Máximo 150 caracteres.
                  </p-message>
                }
              }
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button
              pButton
              type="button"
              severity="secondary"
              [text]="true"
              label="Cancelar"
              [disabled]="saving()"
              (click)="cancel()"
            ></button>
            <button
              pButton
              type="submit"
              label="Guardar Ajustes"
              [loading]="saving()"
              [disabled]="saving()"
            ></button>
          </div>
        </form>
      } @else if (hasData()) {
        <div
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-6 flex flex-col gap-4"
        >
          <div class="flex items-start gap-3">
            <i-lucide [img]="icons.Store" class="size-5 text-primary mt-0.5" />
            <div class="flex flex-col gap-0.5 min-w-0 flex-1">
              <span class="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400">
                Nombre del local
              </span>
              <span class="text-base font-semibold text-surface-900 dark:text-surface-0 truncate">
                {{ profile()?.storeName }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="flex items-start gap-3">
              <i-lucide [img]="icons.MapPin" class="size-5 text-surface-500 mt-0.5" />
              <div class="flex flex-col gap-0.5 min-w-0">
                <span
                  class="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400"
                >
                  Dirección
                </span>
                <span class="text-sm text-surface-700 dark:text-surface-200">
                  {{ profile()?.address ?? 'Sin dirección' }}
                </span>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <i-lucide [img]="icons.Phone" class="size-5 text-surface-500 mt-0.5" />
              <div class="flex flex-col gap-0.5 min-w-0">
                <span
                  class="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400"
                >
                  Teléfono principal
                </span>
                <span class="text-sm text-surface-700 dark:text-surface-200">
                  {{ profile()?.primaryPhone ?? 'Sin teléfono' }}
                </span>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <i-lucide [img]="icons.Phone" class="size-5 text-surface-500 mt-0.5" />
              <div class="flex flex-col gap-0.5 min-w-0">
                <span
                  class="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400"
                >
                  Teléfono secundario
                </span>
                <span class="text-sm text-surface-700 dark:text-surface-200">
                  {{ profile()?.secondaryPhone ?? 'Sin teléfono' }}
                </span>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <i-lucide [img]="icons.Mail" class="size-5 text-surface-500 mt-0.5" />
              <div class="flex flex-col gap-0.5 min-w-0">
                <span
                  class="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400"
                >
                  Email de contacto
                </span>
                <span class="text-sm text-surface-700 dark:text-surface-200 truncate">
                  {{ profile()?.contactEmail ?? 'Sin email' }}
                </span>
              </div>
            </div>
          </div>

          @if (canEdit()) {
            <div class="flex justify-end pt-2 border-t border-surface-200 dark:border-surface-700">
              <button pButton type="button" label="Editar" (click)="startEdit()">
                <i-lucide [img]="icons.Pencil" class="size-4 mr-2" />
              </button>
            </div>
          }
        </div>
      } @else {
        <div
          class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-8 text-center flex flex-col items-center gap-4"
        >
          <i-lucide [img]="icons.Store" class="size-10 text-surface-400" />
          <div class="flex flex-col gap-1">
            <p class="text-base font-medium text-surface-700 dark:text-surface-200">
              Aún no hay información del local.
            </p>
            <p class="text-sm text-surface-500 dark:text-surface-400">
              Agregá el nombre, dirección y formas de contacto.
            </p>
          </div>
          @if (canEdit()) {
            <button pButton type="button" label="Agregar información" (click)="startEdit()">
              <i-lucide [img]="icons.Plus" class="size-4 mr-2" />
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class AdminAjustesGeneralesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(StoreProfileService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  protected readonly icons = { Mail, MapPin, Pencil, Phone, Plus, Store };

  protected readonly profile = this.service.profile;
  protected readonly hasData = this.service.hasData;
  protected readonly saving = this.service.saving;

  protected readonly editing = signal(false);

  protected readonly showSkeleton = computed(
    () => this.service.loading() && this.service.profile() === null,
  );

  protected readonly canEdit = computed(() => {
    const role = this.auth.role();
    return role === 'Admin' || role === 'SuperAdmin';
  });

  protected readonly form = this.fb.group({
    storeName: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
    address: this.fb.nonNullable.control('', [Validators.maxLength(300)]),
    primaryPhone: this.fb.nonNullable.control('', [Validators.maxLength(50)]),
    secondaryPhone: this.fb.nonNullable.control('', [Validators.maxLength(50)]),
    contactEmail: this.fb.nonNullable.control('', [Validators.maxLength(150), Validators.email]),
  });

  protected isInvalid(controlName: ProfileControlName): boolean {
    const c = this.form.controls[controlName];
    return c.invalid && (c.touched || c.dirty);
  }

  protected startEdit(): void {
    if (!this.canEdit()) return;
    const current = this.profile();
    this.form.reset({
      storeName: current?.storeName ?? '',
      address: current?.address ?? '',
      primaryPhone: current?.primaryPhone ?? '',
      secondaryPhone: current?.secondaryPhone ?? '',
      contactEmail: current?.contactEmail ?? '',
    });
    this.editing.set(true);
  }

  protected cancel(): void {
    if (this.saving()) return;
    this.editing.set(false);
  }

  protected submit(): void {
    if (this.saving()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const req: UpdateStoreProfileRequest = {
      storeName: raw.storeName.trim(),
      address: trimOrNull(raw.address),
      primaryPhone: trimOrNull(raw.primaryPhone),
      secondaryPhone: trimOrNull(raw.secondaryPhone),
      contactEmail: trimOrNull(raw.contactEmail),
    };

    this.service.update(req).subscribe({
      next: () => {
        this.notifications.success('Se guardaron los ajustes del local.');
        this.editing.set(false);
      },
      error: (_err: HttpErrorResponse) => {
        // error.interceptor already shows a toast
      },
    });
  }
}
