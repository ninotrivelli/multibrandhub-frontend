import { ContractType } from './brands.types';

/** Spanish labels for brand contract types, shared across features. */
export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  CommissionOnly: 'Solo comisión',
  FixedRent: 'Alquiler fijo',
  Hybrid: 'Mixto',
};

export function contractTypeLabel(contractType: ContractType): string {
  return CONTRACT_TYPE_LABELS[contractType];
}
