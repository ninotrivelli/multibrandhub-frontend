import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { Check, LucideAngularModule, LucideIconData, Minus, Plus, X } from 'lucide-angular';

import {
  CashRegisterMovementType,
  CreateCashRegisterMovementRequest,
} from '../../../../core/cash-register/cash-register.types';

const MAX_DESCRIPTION_LENGTH = 200;
const MAX_NOTES_LENGTH = 500;

interface MovementTypeOption {
  label: string;
  value: CashRegisterMovementType;
  icon: LucideIconData;
}

type MovementFormControlName = 'type' | 'amount' | 'description' | 'notes';

@Component({
  selector: 'app-cash-register-movement-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    MessageModule,
    SelectButtonModule,
    TextareaModule,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cash-register-movement-dialog.component.html',
})
export class CashRegisterMovementDialogComponent {
  readonly visible = input.required<boolean>();
  readonly submitting = input(false);
  readonly submitError = input<string | null>(null);

  readonly visibleChange = output<boolean>();
  readonly createMovement = output<CreateCashRegisterMovementRequest>();

  protected readonly icons = { Check, X };
  protected readonly maxDescriptionLength = MAX_DESCRIPTION_LENGTH;
  protected readonly maxNotesLength = MAX_NOTES_LENGTH;
  protected readonly typeOptions: MovementTypeOption[] = [
    { label: 'Entrada', value: 'CashIn', icon: Plus },
    { label: 'Salida', value: 'CashOut', icon: Minus },
  ];

  protected readonly form = new FormGroup({
    type: new FormControl<CashRegisterMovementType>('CashIn', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    amount: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0.01)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_DESCRIPTION_LENGTH)],
    }),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_NOTES_LENGTH)],
    }),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        untracked(() => this.resetForm());
      }
    });
  }

  protected get descriptionLength(): number {
    return this.form.controls.description.value.length;
  }

  protected get notesLength(): number {
    return this.form.controls.notes.value.length;
  }

  protected isInvalid(controlName: MovementFormControlName): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
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

    const description = this.form.controls.description.value.trim();
    if (!description) {
      this.form.controls.description.setValue('');
      this.form.controls.description.markAsTouched();
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.createMovement.emit({
      type: raw.type,
      amount: raw.amount ?? 0,
      description,
      notes: nullableTrim(raw.notes),
    });
  }

  private resetForm(): void {
    this.form.reset({
      type: 'CashIn',
      amount: null,
      description: '',
      notes: '',
    });
  }
}

function nullableTrim(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
