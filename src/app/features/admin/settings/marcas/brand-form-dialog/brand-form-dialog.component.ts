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
  templateUrl: './brand-form-dialog.component.html',
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
