import { StoreTaskPriority } from '../../../core/tasks/tasks.types';

export const PRIORITY_LABELS: Record<StoreTaskPriority, string> = {
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
};

export const PRIORITY_SEVERITY: Record<StoreTaskPriority, 'danger' | 'warn' | 'secondary'> = {
  High: 'danger',
  Medium: 'warn',
  Low: 'secondary',
};

export interface PriorityOption {
  label: string;
  value: StoreTaskPriority;
}

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { label: 'Alta', value: 'High' },
  { label: 'Media', value: 'Medium' },
  { label: 'Baja', value: 'Low' },
];
