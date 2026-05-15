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
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
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
import { TooltipModule } from 'primeng/tooltip';
import { LucideAngularModule, Minus, Plus, X } from 'lucide-angular';

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
    TooltipModule,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movement-form-dialog.component.html',
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

  protected readonly icons = { X, Plus, Minus };

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
  ];

  protected readonly searchTerm = signal('');
  protected readonly selectedProduct = signal<ProductResponse | null>(null);
  protected readonly searching = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      type: this.fb.nonNullable.control<MovementType>(MovementType.StockIn, [Validators.required]),
      quantity: this.fb.control<number | null>(1, [Validators.required]),
      observations: this.fb.nonNullable.control(''),
    },
    { validators: [movementQuantityValidator] },
  );
  private readonly formStatus = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status)),
    {
      initialValue: this.form.status,
    },
  );

  // Re-emits whenever the `type` control changes, so dependent computeds
  // (`typeHint`, `allowsNegative`) actually re-evaluate. Reading
  // `form.controls.type.value` directly inside a computed does NOT trigger
  // recomputation because that read isn't a signal — that's what caused the
  // hint to stay stuck on the initial value.
  private readonly typeValue = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });

  protected readonly typeHint = computed(() => {
    const value = this.typeValue();
    return this.typeOptions.find((o) => o.value === value)?.hint ?? '';
  });

  protected readonly allowsNegative = computed(() => this.typeValue() === MovementType.Adjustment);

  // Visible after the user starts touching the quantity input. We read
  // `formStatus()` so this re-evaluates whenever validation state changes
  // (the group-level validator for nonZero / negativeNotAllowed flips
  // `form.errors`, which in turn flips `form.status`).
  protected readonly isQuantityInvalid = computed(() => {
    this.formStatus();
    const qtyCtrl = this.form.controls.quantity;
    if (!qtyCtrl.dirty && !qtyCtrl.touched) return false;
    return qtyCtrl.invalid || this.form.errors !== null;
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

// Group-level validator: looks at both `type` and `quantity` because what
// counts as a valid quantity depends on the movement type. Negative values
// are only meaningful for `Adjustment` (the backend normalizes the sign for
// every other type, but we want the user to know).
function movementQuantityValidator(group: AbstractControl): ValidationErrors | null {
  const type = group.get('type')?.value as MovementType | null;
  const qty = group.get('quantity')?.value as number | null | undefined;
  if (qty === null || qty === undefined) return null; // `Validators.required` already covers it
  if (qty === 0) return { nonZero: true };
  if (qty < 0 && type !== MovementType.Adjustment) return { negativeNotAllowed: true };
  return null;
}
