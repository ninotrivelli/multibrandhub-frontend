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

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';

import { NotificationService } from '../../../../../core/notifications/notification.service';
import { BrandsService } from '../brands.service';
import { BrandResponse, ContractType } from '../brands.types';
import { buildCreateBrandRequest, buildUpdateBrandRequest } from '../brand-settings.utils';

type DialogMode = 'create' | 'edit';
type BrandControlName =
  | 'name'
  | 'code'
  | 'logoUrl'
  | 'contactEmail'
  | 'contractType'
  | 'commissionPercentage'
  | 'fixedRentCost';

interface ContractTypeOption {
  label: string;
  value: ContractType;
}

@Component({
  selector: 'app-brand-form-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    SelectModule,
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
      [style]="{ width: '42rem', maxWidth: '95vw' }"
      [header]="mode() === 'create' ? 'Nueva Marca' : 'Editar Marca'"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-1 md:col-span-2">
            <label
              for="brandName"
              class="text-sm font-medium text-surface-700 dark:text-surface-200"
            >
              Nombre de la marca
            </label>
            <input
              pInputText
              id="brandName"
              type="text"
              formControlName="name"
              [invalid]="isInvalid('name')"
              placeholder="Ej: Zendra"
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
              for="brandCode"
              class="text-sm font-medium text-surface-700 dark:text-surface-200"
            >
              Código
            </label>
            <input
              pInputText
              id="brandCode"
              type="text"
              formControlName="code"
              [invalid]="isInvalid('code')"
              placeholder="Ej: ZENDRA"
              (input)="normalizeCodeInput($any($event.target).value)"
              fluid
            />
            @if (mode() === 'edit') {
              <p-message severity="secondary" size="small" variant="simple">
                El código no se puede cambiar.
              </p-message>
            } @else if (isInvalid('code')) {
              @if (form.controls.code.hasError('required')) {
                <p-message severity="error" size="small" variant="simple"
                  >El código es obligatorio.</p-message
                >
              } @else {
                <p-message severity="error" size="small" variant="simple">
                  Sin espacios. Usá mayúsculas, números, guiones o guiones bajos.
                </p-message>
              }
            }
          </div>

          <div class="flex flex-col gap-1">
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
              placeholder="marca@correo.com"
              fluid
            />
            @if (isInvalid('contactEmail')) {
              <p-message severity="error" size="small" variant="simple"
                >Ingresá un email válido.</p-message
              >
            }
          </div>

          <div class="flex flex-col gap-1 md:col-span-2">
            <label for="logoUrl" class="text-sm font-medium text-surface-700 dark:text-surface-200">
              Logo URL
            </label>
            <input
              pInputText
              id="logoUrl"
              type="url"
              formControlName="logoUrl"
              placeholder="https://..."
              fluid
            />
          </div>
        </div>

        <div class="border-t border-surface-200 dark:border-surface-700 pt-4">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div class="flex flex-col gap-1 md:col-span-3">
              <label
                for="contractType"
                class="text-sm font-medium text-surface-700 dark:text-surface-200"
              >
                Acuerdo comercial
              </label>
              <p-select
                inputId="contractType"
                formControlName="contractType"
                [options]="contractTypeOptions"
                optionLabel="label"
                optionValue="value"
                appendTo="body"
                fluid
              />
            </div>

            @if (showCommission()) {
              <div class="flex flex-col gap-1 md:col-span-1">
                <label
                  for="commissionPercentage"
                  class="text-sm font-medium text-surface-700 dark:text-surface-200"
                >
                  Comisión
                </label>
                <p-inputnumber
                  inputId="commissionPercentage"
                  formControlName="commissionPercentage"
                  suffix=" %"
                  [min]="0"
                  [max]="100"
                  [minFractionDigits]="0"
                  [maxFractionDigits]="2"
                  [invalid]="isInvalid('commissionPercentage')"
                  fluid
                />
                @if (isInvalid('commissionPercentage')) {
                  <p-message severity="error" size="small" variant="simple"
                    >Debe estar entre 0 y 100.</p-message
                  >
                }
              </div>
            }

            @if (showFixedRent()) {
              <div class="flex flex-col gap-1 md:col-span-2">
                <label
                  for="fixedRentCost"
                  class="text-sm font-medium text-surface-700 dark:text-surface-200"
                >
                  Alquiler fijo mensual
                </label>
                <p-inputnumber
                  inputId="fixedRentCost"
                  formControlName="fixedRentCost"
                  mode="currency"
                  currency="UYU"
                  locale="es-UY"
                  [min]="0"
                  [minFractionDigits]="0"
                  [maxFractionDigits]="2"
                  [invalid]="isInvalid('fixedRentCost')"
                  fluid
                />
                @if (isInvalid('fixedRentCost')) {
                  <p-message severity="error" size="small" variant="simple"
                    >No puede ser negativo.</p-message
                  >
                }
              </div>
            }
          </div>
        </div>

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
      </form>
    </p-dialog>
  `,
})
export class BrandFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly brands = inject(BrandsService);
  private readonly notifications = inject(NotificationService);

  readonly visible = input.required<boolean>();
  readonly mode = input.required<DialogMode>();
  readonly editing = input<BrandResponse | null>(null);

  readonly visibleChange = output<boolean>();
  readonly saved = output<BrandResponse>();

  protected readonly contractTypeOptions: ContractTypeOption[] = [
    { label: 'Solo comisión', value: 'CommissionOnly' },
    { label: 'Alquiler fijo', value: 'FixedRent' },
    { label: 'Mixto', value: 'Hybrid' },
  ];

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
    code: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(50),
      Validators.pattern(/^[A-Z0-9\-_]+$/),
    ]),
    logoUrl: this.fb.nonNullable.control(''),
    contactEmail: this.fb.nonNullable.control('', [Validators.email]),
    contractType: this.fb.nonNullable.control<ContractType>('Hybrid', [Validators.required]),
    commissionPercentage: this.fb.control<number | null>(10, [
      Validators.required,
      Validators.min(0),
      Validators.max(100),
    ]),
    fixedRentCost: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
  });

  private readonly selectedContractType = toSignal(this.form.controls.contractType.valueChanges, {
    initialValue: this.form.controls.contractType.value,
  });

  protected readonly showCommission = computed(() => this.selectedContractType() !== 'FixedRent');
  protected readonly showFixedRent = computed(
    () => this.selectedContractType() !== 'CommissionOnly',
  );

  constructor() {
    effect(() => {
      const open = this.visible();
      if (open) untracked(() => this.resetFormFromInputs());
    });

    effect(() => {
      const type = this.selectedContractType();
      untracked(() => this.syncAgreementControls(type));
    });
  }

  protected isInvalid(controlName: BrandControlName): boolean {
    const c = this.form.controls[controlName];
    return c.invalid && (c.touched || c.dirty);
  }

  protected normalizeCodeInput(value: string): void {
    this.form.controls.code.setValue(value.toUpperCase(), { emitEvent: false });
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

    this.syncAgreementControls(this.form.controls.contractType.getRawValue());

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);

    const raw = this.form.getRawValue();
    const editingBrand = this.editing();

    if (this.mode() === 'create') {
      this.brands.create(buildCreateBrandRequest(raw)).subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.notifications.success(`Se creó ${created.name}.`);
          this.saved.emit(created);
          this.visibleChange.emit(false);
        },
        error: (err: HttpErrorResponse) => this.handleError(err),
      });
    } else if (editingBrand) {
      this.brands.update(editingBrand.id, buildUpdateBrandRequest(raw)).subscribe({
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

  private syncAgreementControls(type: ContractType): void {
    const commission = this.form.controls.commissionPercentage;
    const fixedRent = this.form.controls.fixedRentCost;

    if (type === 'FixedRent') {
      commission.clearValidators();
      commission.setValue(0, { emitEvent: false });
    } else {
      commission.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
    }

    if (type === 'CommissionOnly') {
      fixedRent.clearValidators();
      fixedRent.setValue(0, { emitEvent: false });
    } else {
      fixedRent.setValidators([Validators.required, Validators.min(0)]);
    }

    commission.updateValueAndValidity({ emitEvent: false });
    fixedRent.updateValueAndValidity({ emitEvent: false });
  }

  private resetFormFromInputs(): void {
    this.submitError.set(null);
    const editingBrand = this.editing();
    const codeCtrl = this.form.controls.code;

    if (this.mode() === 'create') {
      codeCtrl.enable({ emitEvent: false });
      this.form.reset({
        name: '',
        code: '',
        logoUrl: '',
        contactEmail: '',
        contractType: 'Hybrid',
        commissionPercentage: 10,
        fixedRentCost: 0,
      });
    } else if (editingBrand) {
      codeCtrl.disable({ emitEvent: false });
      this.form.reset({
        name: editingBrand.name,
        code: editingBrand.code,
        logoUrl: editingBrand.logoUrl ?? '',
        contactEmail: editingBrand.contactEmail ?? '',
        contractType: editingBrand.contractType,
        commissionPercentage: editingBrand.commissionPercentage,
        fixedRentCost: editingBrand.fixedRentCost,
      });
    }

    this.syncAgreementControls(this.form.controls.contractType.getRawValue());
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
