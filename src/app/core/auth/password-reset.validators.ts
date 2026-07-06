import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 40;

export const PASSWORD_VALIDATORS: ValidatorFn[] = [
  Validators.required,
  Validators.minLength(PASSWORD_MIN_LENGTH),
  Validators.maxLength(PASSWORD_MAX_LENGTH),
  Validators.pattern(/\d/),
];

export const passwordsMatchValidator: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const password = group.get('newPassword')?.value as string | undefined;
  const confirmation = group.get('confirmPassword')?.value as string | undefined;

  if (!password || !confirmation || password === confirmation) return null;
  return { passwordMismatch: true };
};
