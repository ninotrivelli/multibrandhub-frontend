import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { ImageUp, LucideAngularModule, Minus, Plus, RotateCcw, Wand2 } from 'lucide-angular';

import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { BrandsService } from '../../../admin/settings/marcas/brands.service';
import { ProductCategoriesService } from '../product-categories.service';
import { ProductsService } from '../products.service';
import { CreateProductRequest, ProductResponse, UpdateProductRequest } from '../inventory.types';
import { buildSkuCandidate } from '../inventory.utils';

type DialogMode = 'create' | 'edit';

type ControlName =
  | 'sku'
  | 'name'
  | 'brandId'
  | 'categoryId'
  | 'size'
  | 'color'
  | 'price'
  | 'currentStock'
  | 'minStockAlert';

@Component({
  selector: 'app-product-form-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    TooltipModule,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [closable]="!busy()"
      [closeOnEscape]="!busy()"
      [dismissableMask]="!busy()"
      [draggable]="false"
      [style]="{ width: '52rem', maxWidth: '95vw' }"
      [header]="mode() === 'create' ? 'Crear Nuevo Artículo' : 'Editar Artículo'"
    >
      <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">
        @if (mode() === 'create') {
          Registrá un producto que no existe en el catálogo.
        } @else {
          Actualizá los datos del producto. El stock se ajusta desde "Reg. Movimiento".
        }
      </p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-[12rem_1fr]">
          <!-- Photo placeholder (non-functional) -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-surface-700 dark:text-surface-200">
              Foto del Producto
            </label>
            <button
              type="button"
              class="aspect-square rounded-xl border-2 border-dashed border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-900 flex flex-col items-center justify-center gap-2 text-surface-500 dark:text-surface-400 cursor-not-allowed"
              [disabled]="true"
              pTooltip="La carga de imágenes estará disponible próximamente."
              tooltipPosition="bottom"
            >
              <i-lucide [img]="icons.ImageUp" class="size-8" />
              <span class="text-xs text-center px-2 leading-tight">
                Subir foto
                <br />
                <span class="italic">(próximamente)</span>
              </span>
            </button>
            <p class="text-[11px] text-surface-500 dark:text-surface-400 text-center">
              Mientras tanto se usa una imagen genérica de la categoría.
            </p>
          </div>

          <!-- Right column: form fields -->
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="flex flex-col gap-1">
              <label
                for="productName"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                Nombre del Artículo
              </label>
              <input
                pInputText
                id="productName"
                type="text"
                formControlName="name"
                [invalid]="isInvalid('name')"
                placeholder="Ej: Remera Estampada Logo"
                fluid
              />
              @if (isInvalid('name')) {
                <p-message severity="error" size="small" variant="simple">
                  El nombre es obligatorio.
                </p-message>
              }
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="productBrand"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                Marca
              </label>
              <p-select
                inputId="productBrand"
                formControlName="brandId"
                [options]="brandOptions()"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar Marca..."
                appendTo="body"
                [showClear]="false"
                fluid
              />
              @if (isInvalid('brandId')) {
                <p-message severity="error" size="small" variant="simple">
                  Seleccioná una marca.
                </p-message>
              }
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="productCategory"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                Categoría
              </label>
              <p-select
                inputId="productCategory"
                formControlName="categoryId"
                [options]="categoryOptions()"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar Categoría..."
                appendTo="body"
                [showClear]="false"
                [filter]="true"
                filterBy="label"
                fluid
              />
              @if (isInvalid('categoryId')) {
                <p-message severity="error" size="small" variant="simple">
                  Seleccioná una categoría.
                </p-message>
              }
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="productSize"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                Talle
              </label>
              <input
                pInputText
                id="productSize"
                type="text"
                formControlName="size"
                placeholder="Ej: M / 38 / Único"
                fluid
              />
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="productColor"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                Color
              </label>
              <input
                pInputText
                id="productColor"
                type="text"
                formControlName="color"
                placeholder="Ej: Negro"
                fluid
              />
            </div>

            <div class="flex flex-col gap-1 md:col-span-2">
              <label
                for="productSku"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                SKU (Código)
              </label>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <input
                  pInputText
                  id="productSku"
                  type="text"
                  formControlName="sku"
                  [invalid]="isInvalid('sku')"
                  placeholder="Ej: ZEN-REM-002"
                  (input)="normalizeSkuInput($any($event.target).value)"
                  class="flex-1 min-w-0"
                />
                @if (mode() === 'create') {
                  <button
                    pButton
                    type="button"
                    severity="secondary"
                    [outlined]="true"
                    [disabled]="!canGenerateSku()"
                    [loading]="skuGenerating()"
                    pTooltip="Genera un SKU único usando marca, nombre, talle y color cuando estén cargados"
                    tooltipPosition="bottom"
                    (click)="generateSku()"
                    aria-label="Generar SKU único automáticamente"
                    [class.sku-generate-ready]="isSkuGeneratorReady()"
                    class="w-full justify-center gap-2 whitespace-nowrap sm:w-auto"
                  >
                    <i-lucide [img]="icons.Wand2" class="size-4" />
                    <span>Generar SKU único</span>
                  </button>
                }
              </div>
              @if (mode() === 'edit') {
                <p-message severity="secondary" size="small" variant="simple">
                  El SKU no se puede modificar.
                </p-message>
              } @else if (isInvalid('sku')) {
                @if (form.controls.sku.hasError('required')) {
                  <p-message severity="error" size="small" variant="simple">
                    El SKU es obligatorio.
                  </p-message>
                } @else {
                  <p-message severity="error" size="small" variant="simple">
                    Usá mayúsculas, números, guiones o guiones bajos.
                  </p-message>
                }
              }
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="productPrice"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                Precio de Venta ($)
              </label>
              <p-inputnumber
                inputId="productPrice"
                formControlName="price"
                mode="currency"
                currency="UYU"
                locale="es-UY"
                [min]="0"
                [minFractionDigits]="0"
                [maxFractionDigits]="2"
                [invalid]="isInvalid('price')"
                fluid
              />
              @if (isInvalid('price')) {
                <p-message severity="error" size="small" variant="simple">
                  Ingresá un precio válido.
                </p-message>
              }
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="productMinAlert"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                Umbral de stock crítico
              </label>
              <p-inputnumber
                inputId="productMinAlert"
                formControlName="minStockAlert"
                [min]="0"
                [showButtons]="true"
                buttonLayout="horizontal"
                spinnerMode="horizontal"
                [step]="1"
                fluid
              >
                <ng-template pTemplate="incrementbuttonicon">
                  <i-lucide [img]="icons.Plus" class="size-4" />
                </ng-template>
                <ng-template pTemplate="decrementbuttonicon">
                  <i-lucide [img]="icons.Minus" class="size-4" />
                </ng-template>
              </p-inputnumber>
              <small class="text-xs text-surface-500 dark:text-surface-400">
                Cuando el stock llegue a este número, aparece como crítico.
              </small>
            </div>

            @if (mode() === 'create') {
              <div class="flex flex-col gap-1 md:col-span-2">
                <label
                  for="productStock"
                  class="text-sm font-medium text-surface-700 dark:text-surface-200"
                >
                  Stock Inicial de Ingreso
                </label>
                <p-inputnumber
                  inputId="productStock"
                  formControlName="currentStock"
                  [min]="0"
                  [showButtons]="true"
                  buttonLayout="horizontal"
                  spinnerMode="horizontal"
                  [step]="1"
                  [invalid]="isInvalid('currentStock')"
                  fluid
                >
                  <ng-template pTemplate="incrementbuttonicon">
                    <i-lucide [img]="icons.Plus" class="size-4" />
                  </ng-template>
                  <ng-template pTemplate="decrementbuttonicon">
                    <i-lucide [img]="icons.Minus" class="size-4" />
                  </ng-template>
                </p-inputnumber>
                <small class="text-xs text-surface-500 dark:text-surface-400">
                  Unidades que entran físicamente al local ahora.
                </small>
                @if (isInvalid('currentStock')) {
                  <p-message severity="error" size="small" variant="simple">
                    No puede ser negativo.
                  </p-message>
                }
              </div>
            }
          </div>
        </div>

        @if (submitError()) {
          <p-message severity="error" variant="outlined" closable="false">
            {{ submitError() }}
          </p-message>
        }

        <div
          class="flex flex-col gap-2 pt-2 border-t border-surface-200 dark:border-surface-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            @if (canReactivateEditing()) {
              <button
                pButton
                type="button"
                severity="success"
                [outlined]="true"
                label="Reactivar artículo"
                [loading]="reactivating()"
                [disabled]="busy()"
                (click)="reactivateEditing()"
              >
                <i-lucide [img]="icons.RotateCcw" class="size-4 mr-2" />
              </button>
            }
          </div>
          <div class="flex justify-end gap-2">
            <button
              pButton
              type="button"
              severity="secondary"
              [text]="true"
              label="Cancelar"
              [disabled]="busy()"
              (click)="cancel()"
            ></button>
            <button
              pButton
              type="submit"
              [label]="mode() === 'create' ? 'Ingresar nuevo Artículo' : 'Guardar Cambios'"
              [loading]="submitting()"
              [disabled]="busy()"
            ></button>
          </div>
        </div>
      </form>
    </p-dialog>
  `,
  styles: [
    `
      .sku-generate-ready.p-button.p-button-outlined {
        border-color: #8b5cf6;
        color: #6d28d9;
        box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.22);
        animation: sku-ready-glow 2.4s ease-in-out infinite;
      }

      .sku-generate-ready.p-button.p-button-outlined:hover {
        border-color: #7c3aed;
        box-shadow:
          0 0 0 1px rgba(124, 58, 237, 0.32),
          0 0 18px rgba(139, 92, 246, 0.28);
      }

      @keyframes sku-ready-glow {
        0%,
        100% {
          box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.2);
        }
        50% {
          box-shadow:
            0 0 0 1px rgba(139, 92, 246, 0.45),
            0 0 16px rgba(139, 92, 246, 0.3);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .sku-generate-ready.p-button.p-button-outlined {
          animation: none;
        }
      }
    `,
  ],
})
export class ProductFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly products = inject(ProductsService);
  private readonly brands = inject(BrandsService);
  private readonly categories = inject(ProductCategoriesService);
  private readonly notifications = inject(NotificationService);

  readonly visible = input.required<boolean>();
  readonly mode = input.required<DialogMode>();
  readonly editing = input<ProductResponse | null>(null);

  readonly visibleChange = output<boolean>();
  readonly saved = output<ProductResponse>();

  protected readonly icons = { ImageUp, Plus, Minus, RotateCcw, Wand2 };

  protected readonly submitting = signal(false);
  protected readonly reactivating = signal(false);
  protected readonly busy = computed(() => this.submitting() || this.reactivating());
  protected readonly submitError = signal<string | null>(null);
  protected readonly skuGenerating = signal(false);

  protected readonly form = this.fb.group({
    sku: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(50),
      Validators.pattern(/^[A-Z0-9\-_]+$/),
    ]),
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
    brandId: this.fb.nonNullable.control<string | null>(null, [Validators.required]),
    categoryId: this.fb.nonNullable.control<string | null>(null, [Validators.required]),
    size: this.fb.nonNullable.control(''),
    color: this.fb.nonNullable.control(''),
    price: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    currentStock: this.fb.control<number | null>(1, [Validators.required, Validators.min(0)]),
    minStockAlert: this.fb.control<number | null>(2, [Validators.required, Validators.min(0)]),
  });

  // Mirror live form values as signals so canGenerateSku() reacts without
  // OnPush change-detection hiccups (the button lives outside the input that
  // produced the change).
  private readonly nameValue = toSignal(this.form.controls.name.valueChanges, {
    initialValue: '',
  });
  private readonly brandIdValue = toSignal(this.form.controls.brandId.valueChanges, {
    initialValue: null as string | null,
  });
  private readonly categoryIdValue = toSignal(this.form.controls.categoryId.valueChanges, {
    initialValue: null as string | null,
  });
  private readonly sizeValue = toSignal(this.form.controls.size.valueChanges, {
    initialValue: '',
  });
  private readonly colorValue = toSignal(this.form.controls.color.valueChanges, {
    initialValue: '',
  });
  protected readonly canGenerateSku = computed(
    () =>
      this.mode() === 'create' &&
      !this.skuGenerating() &&
      (this.nameValue() ?? '').trim().length > 0 &&
      !!this.brandIdValue() &&
      !!this.categoryIdValue(),
  );
  protected readonly isSkuGeneratorReady = computed(
    () =>
      this.canGenerateSku() &&
      (this.sizeValue() ?? '').trim().length > 0 &&
      (this.colorValue() ?? '').trim().length > 0,
  );
  protected readonly canReactivateEditing = computed(() => {
    const role = this.auth.role();
    return (
      this.mode() === 'edit' &&
      this.editing()?.isActive === false &&
      (role === 'Admin' || role === 'SuperAdmin' || role === 'Seller')
    );
  });

  protected readonly brandOptions = computed(() =>
    this.brands
      .items()
      .filter((b) => b.status === 'Active')
      .map((b) => ({ label: b.name, value: b.id })),
  );

  protected readonly categoryOptions = computed(() =>
    this.categories.items().map((c) => ({ label: c.name, value: c.id })),
  );

  constructor() {
    effect(() => {
      const open = this.visible();
      if (open) untracked(() => this.resetFormFromInputs());
    });
  }

  protected isInvalid(controlName: ControlName): boolean {
    const c = this.form.controls[controlName];
    return c.invalid && (c.touched || c.dirty);
  }

  protected normalizeSkuInput(value: string): void {
    this.form.controls.sku.setValue(value.toUpperCase(), { emitEvent: false });
  }

  protected async generateSku(): Promise<void> {
    if (!this.canGenerateSku()) return;

    const name = this.form.controls.name.value.trim();
    const brandId = this.form.controls.brandId.value;
    const categoryId = this.form.controls.categoryId.value;
    if (!name || !brandId || !categoryId) return;

    const brand = this.brands.items().find((b) => b.id === brandId);
    if (!brand) {
      this.notifications.error('No encontramos la marca seleccionada. Probá de nuevo.');
      return;
    }

    this.skuGenerating.set(true);
    try {
      const MAX_ATTEMPTS = 50;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const candidate = buildSkuCandidate({
          brandCode: brand.code,
          productName: name,
          size: this.form.controls.size.value,
          color: this.form.controls.color.value,
          attempt,
        });
        const result = await firstValueFrom(this.products.validateSku(candidate));
        if (result.isUnique) {
          this.form.controls.sku.setValue(result.sku);
          this.form.controls.sku.markAsDirty();
          return;
        }
      }
      this.notifications.error(
        'No pudimos generar un SKU automáticamente. Probá ingresarlo a mano.',
      );
    } catch {
      this.notifications.error('No se pudo validar el SKU. Probá de nuevo o ingresalo a mano.');
    } finally {
      this.skuGenerating.set(false);
    }
  }

  protected onVisibleChange(value: boolean): void {
    if (!value && this.busy()) return;
    this.visibleChange.emit(value);
  }

  protected cancel(): void {
    if (this.busy()) return;
    this.visibleChange.emit(false);
  }

  protected submit(): void {
    if (this.busy()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);

    const raw = this.form.getRawValue();
    const editing = this.editing();

    if (this.mode() === 'create') {
      const body: CreateProductRequest = {
        sku: (raw.sku ?? '').trim().toUpperCase(),
        name: (raw.name ?? '').trim(),
        description: null,
        imageUrl: null,
        price: Number(raw.price ?? 0),
        color: nullableTrim(raw.color),
        size: nullableTrim(raw.size),
        currentStock: Number(raw.currentStock ?? 0),
        minStockAlert: Number(raw.minStockAlert ?? 0),
        brandId: raw.brandId!,
        categoryId: raw.categoryId!,
      };
      this.products.create(body).subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.notifications.success(`Se creó ${created.name}.`);
          this.saved.emit(created);
          this.visibleChange.emit(false);
        },
        error: (err: HttpErrorResponse) => this.handleError(err),
      });
    } else if (editing) {
      const body: UpdateProductRequest = {
        name: (raw.name ?? '').trim(),
        description: null,
        imageUrl: editing.imageUrl,
        price: Number(raw.price ?? 0),
        color: nullableTrim(raw.color),
        size: nullableTrim(raw.size),
        minStockAlert: Number(raw.minStockAlert ?? 0),
        categoryId: raw.categoryId!,
      };
      this.products.update(editing.id, body).subscribe({
        next: (updated) => {
          this.submitting.set(false);
          this.notifications.success(`Se actualizó ${updated.name}.`);
          this.saved.emit(updated);
          this.visibleChange.emit(false);
        },
        error: (err: HttpErrorResponse) => this.handleError(err),
      });
    }
  }

  protected reactivateEditing(): void {
    const editing = this.editing();
    if (!editing || !this.canReactivateEditing() || this.busy()) return;

    this.submitError.set(null);
    this.reactivating.set(true);
    this.products.reactivate(editing.id).subscribe({
      next: (updated) => {
        this.reactivating.set(false);
        this.notifications.success(`Se reactivó ${updated.name}.`);
        this.saved.emit(updated);
        this.visibleChange.emit(false);
      },
      error: (err: HttpErrorResponse) => this.handleReactivateError(err),
    });
  }

  private resetFormFromInputs(): void {
    this.submitError.set(null);
    const editing = this.editing();
    const skuCtrl = this.form.controls.sku;
    const brandCtrl = this.form.controls.brandId;
    const stockCtrl = this.form.controls.currentStock;

    if (this.mode() === 'create') {
      skuCtrl.enable({ emitEvent: false });
      stockCtrl.enable({ emitEvent: false });
      // BrandManagers can only create within their own brand; lock the field.
      const role = this.auth.role();
      const ownBrandId = this.auth.user()?.brandId ?? null;
      if (role === 'BrandManager' && ownBrandId) {
        brandCtrl.disable({ emitEvent: false });
        this.form.reset({
          sku: '',
          name: '',
          brandId: ownBrandId,
          categoryId: null,
          size: '',
          color: '',
          price: 0,
          currentStock: 1,
          minStockAlert: 2,
        });
      } else {
        brandCtrl.enable({ emitEvent: false });
        this.form.reset({
          sku: '',
          name: '',
          brandId: null,
          categoryId: null,
          size: '',
          color: '',
          price: 0,
          currentStock: 1,
          minStockAlert: 2,
        });
      }
    } else if (editing) {
      skuCtrl.disable({ emitEvent: false });
      brandCtrl.disable({ emitEvent: false });
      stockCtrl.disable({ emitEvent: false });
      this.form.reset({
        sku: editing.sku,
        name: editing.name,
        brandId: editing.brandId,
        categoryId: editing.categoryId,
        size: editing.size ?? '',
        color: editing.color ?? '',
        price: editing.price,
        currentStock: editing.currentStock,
        minStockAlert: editing.minStockAlert,
      });
    }
  }

  private handleError(err: HttpErrorResponse): void {
    this.submitting.set(false);
    this.setSubmitError(err);
  }

  private handleReactivateError(err: HttpErrorResponse): void {
    this.reactivating.set(false);
    this.setSubmitError(err);
  }

  private setSubmitError(err: HttpErrorResponse): void {
    const body = err.error as { message?: string; errors?: { message: string }[] } | undefined;
    if (body?.errors?.length) {
      this.submitError.set(body.errors.map((e) => e.message).join(' • '));
    } else if (body?.message) {
      this.submitError.set(body.message);
    } else {
      this.submitError.set('No se pudo guardar. Probá de nuevo.');
    }
  }
}

function nullableTrim(value: string | null | undefined): string | null {
  const t = value?.trim() ?? '';
  return t.length > 0 ? t : null;
}
