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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { ImageUp, LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { BrandsService } from '../../../admin/settings/marcas/brands.service';
import { ProductCategoriesService } from '../product-categories.service';
import { ProductsService } from '../products.service';
import { CreateProductRequest, ProductResponse, UpdateProductRequest } from '../inventory.types';

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
      [closable]="!submitting()"
      [closeOnEscape]="!submitting()"
      [dismissableMask]="!submitting()"
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
                for="productSku"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                SKU (Código)
              </label>
              <input
                pInputText
                id="productSku"
                type="text"
                formControlName="sku"
                [invalid]="isInvalid('sku')"
                placeholder="Ej: ZEN-REM-002"
                (input)="normalizeSkuInput($any($event.target).value)"
                fluid
              />
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
                incrementButtonIcon="pi pi-plus"
                decrementButtonIcon="pi pi-minus"
                fluid
              />
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
                  incrementButtonIcon="pi pi-plus"
                  decrementButtonIcon="pi pi-minus"
                  [invalid]="isInvalid('currentStock')"
                  fluid
                />
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
          class="flex justify-end gap-2 pt-2 border-t border-surface-200 dark:border-surface-700"
        >
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
            [label]="mode() === 'create' ? 'Ingresar nuevo Artículo' : 'Guardar Cambios'"
            [loading]="submitting()"
            [disabled]="submitting()"
          ></button>
        </div>
      </form>
    </p-dialog>
  `,
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

  protected readonly icons = { ImageUp };

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

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

  protected onVisibleChange(value: boolean): void {
    if (!value && this.submitting()) return;
    this.visibleChange.emit(value);
  }

  protected cancel(): void {
    this.visibleChange.emit(false);
  }

  protected submit(): void {
    if (this.submitting()) return;

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
