import type { Preset } from '@primeuix/themes/types';

/** Identifiers for the user-selectable themes. Persisted in localStorage. */
export type ThemeId = 'default' | 'executive' | 'fresh' | 'dark';

export interface ThemeOption {
  readonly id: ThemeId;
  /** Spanish label shown to the end user. */
  readonly label: string;
  /** Short Spanish description shown under the label. */
  readonly description: string;
  /** Whether this theme applies the `.app-dark` selector. */
  readonly dark: boolean;
  /** PrimeNG preset to activate at runtime via `usePreset`. */
  readonly preset: Preset;
  /** 2-3 hex colors for the preview swatch in the selector UI. */
  readonly swatches: readonly string[];
}
