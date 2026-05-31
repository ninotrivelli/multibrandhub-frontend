import { Injectable, signal } from '@angular/core';
import { usePreset } from '@primeuix/themes';

import { DEFAULT_PRESET, EXECUTIVE_PRESET, FRESH_PRESET } from './theme.presets';
import { ThemeId, ThemeOption } from './theme.types';

const STORAGE_KEY = 'mbh-theme';

/** Class toggled on <html>; mirrors `darkModeSelector` in app.config.ts. */
const DARK_CLASS = 'app-dark';

const DEFAULT_THEME: ThemeId = 'default';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Ordered list of selectable themes, surfaced to the selector UI. */
  readonly themes: readonly ThemeOption[] = [
    {
      id: 'default',
      label: 'Predeterminado',
      description: 'El tema clásico de MultiBrandHub.',
      dark: false,
      preset: DEFAULT_PRESET,
      swatches: ['#4f46e5', '#818cf8', '#ffffff'],
    },
    {
      id: 'executive',
      label: 'Ejecutivo',
      description: 'Sobrio y elegante, con acentos en negro.',
      dark: false,
      preset: EXECUTIVE_PRESET,
      swatches: ['#18181b', '#52525b', '#ffffff'],
    },
    {
      id: 'fresh',
      label: 'Fresco',
      description: 'Verde moderno y luminoso.',
      dark: false,
      preset: FRESH_PRESET,
      swatches: ['#059669', '#34d399', '#ffffff'],
    },
    {
      id: 'dark',
      label: 'Oscuro',
      description: 'Ideal para ambientes con poca luz.',
      dark: true,
      preset: DEFAULT_PRESET,
      swatches: ['#818cf8', '#27272a', '#18181b'],
    },
  ];

  private readonly _current = signal<ThemeId>(this.readStored());

  /** Currently selected theme id. */
  readonly current = this._current.asReadonly();

  /**
   * Applies the persisted theme. Called once from an app initializer so the
   * stored preset is active before the first screen renders.
   */
  init(): void {
    this.apply(this.optionFor(this._current()));
  }

  setTheme(id: ThemeId): void {
    const option = this.themes.find((t) => t.id === id);
    if (!option) return;

    this._current.set(id);
    this.persist(id);
    this.apply(option);
  }

  private apply(option: ThemeOption): void {
    usePreset(option.preset);

    try {
      document.documentElement.classList.toggle(DARK_CLASS, option.dark);
    } catch {
      // No document (SSR / non-browser test env) — nothing to toggle.
    }
  }

  private optionFor(id: ThemeId): ThemeOption {
    return this.themes.find((t) => t.id === id) ?? this.themes[0];
  }

  private readStored(): ThemeId {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && this.themes.some((t) => t.id === raw)) {
        return raw as ThemeId;
      }
    } catch {
      // localStorage unavailable (private mode / SSR) — fall back to default.
    }
    return DEFAULT_THEME;
  }

  private persist(id: ThemeId): void {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Persistence is best-effort; ignore write failures.
    }
  }
}
