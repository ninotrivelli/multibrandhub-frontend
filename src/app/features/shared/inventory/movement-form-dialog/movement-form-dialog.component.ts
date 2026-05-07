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
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';

import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ProductsService } from '../products.service';
import { StockMovementsService } from '../stock-movements.service';
import {
  CreateStockMovementRequest,
  MovementType,
  ProductResponse,
  StockMovementResponse,
} from '../inventory.types';

interface MovementTypeOption {
  label: string;
  value: MovementType;
  hint: string;
}

@Component({
  selector: 'app-movement-form-dialog',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    TagModule,
    TextareaModule,
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
      [style]="{ width: '38rem', maxWidth: '95vw' }"
      header="Registrar Movimiento"
    >
      <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">
        Ajuste de stock para artículos existentes.
      </p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label
            for="movementSearch"
            class="text-sm font-medium text-surface-700 dark:text-surface-200"
          >
            Buscar Artículo (SKU o Nombre)
          </label>
          <input
            pInputText
            id="movementSearch"
            type="text"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
            [ngModelOptions]="{ standalone: true }"
            [placeholder]="
              selectedProduct()
                ? 'Buscar otro artículo...'
                : 'Escribí SKU, nombre, talle o color...'
            "
            fluid
          />
        </div>

        @if (selectedProduct(); as p) {
          <div
            class="rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 p-3 flex items-center justify-between gap-3"
          >
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="font-medium text-surface-900 dark:text-surface-0 truncate">
                {{ p.name }} ({{ p.sku }})
              </span>
              <span class="text-xs text-surface-500 dark:text-surface-400">
                Stock actual: <strong>{{ p.currentStock }}</strong> unids.
              </span>
            </div>
            <button
              pButton
              type="button"
              severity="secondary"
              [text]="true"
              icon="pi pi-times"
              size="small"
              (click)="clearSelection()"
            ></button>
          </div>
        }

        @if (searchTerm().trim().length > 0) {
          @if (searching()) {
            <div class="text-sm text-surface-500 dark:text-surface-400">Buscando...</div>
          } @else if (searchResults().length === 0) {
            <div class="text-sm text-surface-500 dark:text-surface-400">
              No se encontraron artículos.
            </div>
          } @else {
            <div
              class="rounded-lg border border-surface-200 dark:border-surface-700 max-h-48 overflow-y-auto divide-y divide-surface-200 dark:divide-surface-700"
            >
              @for (p of searchResults(); track p.id) {
                <button
                  type="button"
                  class="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  (click)="selectProduct(p)"
                >
                  <div class="flex flex-col min-w-0">
                    <span class="font-medium text-sm text-surface-900 dark:text-surface-0 truncate">
                      {{ p.name }}
                    </span>
                    <span class="text-xs text-surface-500 dark:text-surface-400 truncate">
                      {{ p.sku }} · {{ p.brandName }}
                    </span>
                  </div>
                  <span
                    class="text-xs text-surface-500 dark:text-surface-400 whitespace-nowrap shrink-0"
                  >
                    Stock: {{ p.currentStock }}
                  </span>
                </button>
              }
            </div>
          }
        }

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-1">
            <label
              for="movementType"
              class="text-sm font-medium text-surface-700 dark:text-surface-200"
            >
              Tipo de Movimiento
            </label>
            <p-select
              inputId="movementType"
              formControlName="type"
              [options]="typeOptions"
              optionLabel="label"
              optionValue="value"
              appendTo="body"
              fluid
            />
            <p class="text-[11px] text-surface-500 dark:text-surface-400">{{ typeHint() }}</p>
          </div>

          <div class="flex flex-col gap-1">
            <label
              for="movementQty"
              class="text-sm font-medium text-surface-700 dark:text-surface-200"
            >
              Cantidad {{ allowsNegative() ? '(+/-)' : '' }}
            </label>
            <p-inputnumber
              inputId="movementQty"
              formControlName="quantity"
              [showButtons]="true"
              buttonLayout="horizontal"
              spinnerMode="horizontal"
              [step]="1"
              incrementButtonClass="!bg-surface-100 hover:!bg-surface-200 active:!bg-surface-300 !border-surface-300 !text-surface-700 dark:!bg-surface-800 dark:hover:!bg-surface-700 dark:active:!bg-surface-600 dark:!border-surface-600 dark:!text-surface-100"
              decrementButtonClass="!bg-surface-100 hover:!bg-surface-200 active:!bg-surface-300 !border-surface-300 !text-surface-700 dark:!bg-surface-800 dark:hover:!bg-surface-700 dark:active:!bg-surface-600 dark:!border-surface-600 dark:!text-surface-100"
              [min]="allowsNegative() ? -9999 : 1"
              [invalid]="isInvalid('quantity')"
              fluid
            >
              <ng-template #incrementbuttonicon>
                <span class="pi pi-plus !text-surface-700 dark:!text-surface-100"></span>
              </ng-template>
              <ng-template #decrementbuttonicon>
                <span class="pi pi-minus !text-surface-700 dark:!text-surface-100"></span>
              </ng-template>
            </p-inputnumber>
            @if (isInvalid('quantity')) {
              <p-message severity="error" size="small" variant="simple">
                Ingresá una cantidad distinta de cero.
              </p-message>
            }
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label
            for="movementObs"
            class="text-sm font-medium text-surface-700 dark:text-surface-200"
          >
            Motivo / Observaciones (Opcional)
          </label>
          <textarea
            pTextarea
            id="movementObs"
            formControlName="observations"
            rows="2"
            placeholder="Ej: Prendas prestadas a @influencer para sesión de fotos."
            [autoResize]="false"
          ></textarea>
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
            label="Confirmar Movimiento"
            [loading]="submitting()"
            [disabled]="submitting() || !canSubmit()"
          ></button>
        </div>
      </form>
    </p-dialog>
  `,
})
export class MovementFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly products = inject(ProductsService);
  private readonly movements = inject(StockMovementsService);
  private readonly notifications = inject(NotificationService);

  readonly visible = input.required<boolean>();
  readonly initialProduct = input<ProductResponse | null>(null);

  readonly visibleChange = output<boolean>();
  readonly saved = output<StockMovementResponse>();

  protected readonly typeOptions: MovementTypeOption[] = [
    {
      label: 'Ingreso / Re-stock',
      value: MovementType.StockIn,
      hint: 'Suma stock. Ingresá la cantidad recibida.',
    },
    {
      label: 'Egreso (Pérdida / Rotura)',
      value: MovementType.Loss,
      hint: 'Ingresá las unidades perdidas / rotas.',
    },
    {
      label: 'Ajuste manual',
      value: MovementType.Adjustment,
      hint: 'Corrige el stock. Usá positivo para sumar o negativo para restar.',
    },
    {
      label: 'Devolución',
      value: MovementType.Return,
      hint: 'Devolución de cliente. Suma stock.',
    },
    {
      label: 'Sesión de fotos',
      value: MovementType.Shooting,
      hint: 'Resta stock. Ingresá las unidades que salen temporalmente.',
    },
  ];

  protected readonly searchTerm = signal('');
  protected readonly selectedProduct = signal<ProductResponse | null>(null);
  protected readonly searching = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    type: this.fb.nonNullable.control<MovementType>(MovementType.StockIn, [Validators.required]),
    quantity: this.fb.control<number | null>(1, [
      Validators.required,
      (c) => (c.value === 0 ? { nonZero: true } : null),
    ]),
    observations: this.fb.nonNullable.control(''),
  });
  private readonly formStatus = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status)),
    {
      initialValue: this.form.status,
    },
  );

  protected readonly typeHint = computed(() => {
    const value = this.form.controls.type.value;
    return this.typeOptions.find((o) => o.value === value)?.hint ?? '';
  });

  protected readonly allowsNegative = computed(() => {
    const t = this.form.controls.type.value;
    return t === MovementType.Adjustment;
  });

  protected readonly canSubmit = computed(
    () => this.selectedProduct() !== null && this.formStatus() === 'VALID',
  );

  // Live-search products as the user types. Keep it active even when a product
  // is selected, so users can replace a mistaken selection without closing.
  private readonly searchResults$ = toObservable(this.searchTerm).pipe(
    debounceTime(250),
    distinctUntilChanged(),
    switchMap((term) => {
      if (!term || term.trim().length < 1) {
        this.searching.set(false);
        return of([] as ProductResponse[]);
      }
      this.searching.set(true);
      return this.products
        .searchOnce({ searchTerm: term, page: 1, pageSize: 8 })
        .pipe(map((res) => res.items));
    }),
  );

  protected readonly searchResults = toSignal(this.searchResults$, { initialValue: [] });

  constructor() {
    effect(() => {
      const open = this.visible();
      if (open) untracked(() => this.resetFromInputs());
    });

    // Stop the spinner when results land.
    effect(() => {
      this.searchResults();
      untracked(() => this.searching.set(false));
    });
  }

  protected isInvalid(controlName: 'type' | 'quantity' | 'observations'): boolean {
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

  protected selectProduct(p: ProductResponse): void {
    this.selectedProduct.set(p);
    this.searchTerm.set('');
    this.submitError.set(null);
  }

  protected clearSelection(): void {
    this.selectedProduct.set(null);
    this.searchTerm.set('');
  }

  protected submit(): void {
    if (this.submitting()) return;
    const product = this.selectedProduct();
    if (!product) {
      this.submitError.set('Seleccioná un artículo antes de continuar.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);

    const raw = this.form.getRawValue();
    const userId = this.auth.user()?.userId ?? null;

    // The API is the source of truth for signed stock deltas. Manual entries
    // send the user's quantity and the backend normalizes it by movement type.
    const quantity = Number(raw.quantity ?? 0);

    const body: CreateStockMovementRequest = {
      productId: product.id,
      quantity,
      type: raw.type,
      observations: nullableTrim(raw.observations),
      userId,
    };

    this.movements.create(body).subscribe({
      next: (created) => {
        this.submitting.set(false);
        const label = created.quantity >= 0 ? `+${created.quantity}` : `${created.quantity}`;
        this.notifications.success(`Movimiento registrado para ${product.name} (${label} unids.).`);
        this.saved.emit(created);
        this.visibleChange.emit(false);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        const body = err.error as { message?: string; errors?: { message: string }[] } | undefined;
        if (body?.errors?.length) {
          this.submitError.set(body.errors.map((e) => e.message).join(' • '));
        } else if (body?.message) {
          this.submitError.set(body.message);
        } else {
          this.submitError.set('No se pudo registrar el movimiento. Probá de nuevo.');
        }
      },
    });
  }

  private resetFromInputs(): void {
    this.submitError.set(null);
    this.searchTerm.set('');
    this.selectedProduct.set(this.initialProduct());
    this.form.reset({
      type: MovementType.StockIn,
      quantity: 1,
      observations: '',
    });
  }
}

function nullableTrim(value: string | null | undefined): string | null {
  const t = value?.trim() ?? '';
  return t.length > 0 ? t : null;
}
