import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  untracked,
} from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { Check, LucideAngularModule, X } from 'lucide-angular';

import {
  CashRegisterSessionResponse,
  CloseCashRegisterRequest,
} from '../../../../core/cash-register/cash-register.types';
import { PaymentMethod } from '../../../../core/sales/sales.types';
import { paymentMethodLabel } from '../../../../core/sales/sales.utils';
import { formatCurrencyUYU } from '../../../shared/inventory/inventory.utils';

type ReportedTotalForm = FormGroup<{
  brandId: FormControl<string>;
  paymentMethod: FormControl<PaymentMethod>;
  reportedAmount: FormControl<number | null>;
}>;

@Component({
  selector: 'app-cash-register-close-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    MessageModule,
    TableModule,
    TextareaModule,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cash-register-close-dialog.component.html',
})
export class CashRegisterCloseDialogComponent {
  readonly visible = input.required<boolean>();
  readonly session = input<CashRegisterSessionResponse | null>(null);
  readonly submitting = input(false);
  readonly submitError = input<string | null>(null);

  readonly visibleChange = output<boolean>();
  readonly closeRegister = output<CloseCashRegisterRequest>();

  protected readonly icons = { Check, X };
  protected readonly maxNotesLength = 500;

  protected readonly form = new FormGroup({
    actualCashAmount: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    reportedTotals: new FormArray<ReportedTotalForm>([]),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        untracked(() => this.resetForm());
      }
    });
  }

  protected get reportedTotals(): FormArray<ReportedTotalForm> {
    return this.form.controls.reportedTotals;
  }

  protected get notesLength(): number {
    return this.form.controls.notes.value.length;
  }

  protected isActualCashInvalid(): boolean {
    const control = this.form.controls.actualCashAmount;
    return control.invalid && (control.touched || control.dirty);
  }

  protected isNotesInvalid(): boolean {
    const control = this.form.controls.notes;
    return control.invalid && (control.touched || control.dirty);
  }

  protected isReportedAmountInvalid(index: number): boolean {
    const control = this.reportedTotals.at(index)?.controls.reportedAmount;
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  protected onVisibleChange(value: boolean): void {
    if (!value && this.submitting()) return;
    this.visibleChange.emit(value);
  }

  protected cancel(): void {
    if (this.submitting()) return;
    this.visibleChange.emit(false);
  }

  protected submit(): void {
    if (this.submitting()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const actualCashAmount = raw.actualCashAmount ?? 0;
    const notes = raw.notes.trim();

    this.closeRegister.emit({
      actualCashAmount,
      notes: notes.length > 0 ? notes : null,
      reportedTotals: raw.reportedTotals.map((line) => ({
        brandId: line.brandId,
        paymentMethod: line.paymentMethod,
        reportedAmount: line.reportedAmount ?? 0,
      })),
    });
  }

  protected paymentLabel(method: PaymentMethod): string {
    return paymentMethodLabel(method);
  }

  protected formatCurrency(value: number | null | undefined): string {
    return formatCurrencyUYU(value ?? 0);
  }

  protected formatSignedCurrency(value: number | null | undefined): string {
    const amount = value ?? 0;
    const formatted = this.formatCurrency(Math.abs(amount));
    if (amount > 0) return `+${formatted}`;
    if (amount < 0) return `-${formatted}`;
    return formatted;
  }

  protected varianceFor(index: number, systemNetAmount: number): number | null {
    const value = this.reportedTotals.at(index)?.controls.reportedAmount.value;
    return value === null || value === undefined ? null : value - systemNetAmount;
  }

  protected varianceClass(value: number | null | undefined): string {
    const amount = value ?? 0;
    if (amount > 0) return 'text-emerald-700 dark:text-emerald-300';
    if (amount < 0) return 'text-red-600 dark:text-red-300';
    return 'text-surface-600 dark:text-surface-300';
  }

  private resetForm(): void {
    const session = this.session();
    this.form.controls.actualCashAmount.reset(null);
    this.form.controls.notes.reset('');
    this.reportedTotals.clear();

    for (const line of session?.reconciliationLines ?? []) {
      this.reportedTotals.push(
        new FormGroup({
          brandId: new FormControl(line.brandId, { nonNullable: true }),
          paymentMethod: new FormControl(line.paymentMethod, { nonNullable: true }),
          reportedAmount: new FormControl<number | null>(line.systemNetAmount, {
            validators: [Validators.required],
          }),
        }),
      );
    }
  }
}
