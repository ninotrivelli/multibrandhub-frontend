import { Injectable, signal } from '@angular/core';

type SessionStateResetter = () => void;

@Injectable({ providedIn: 'root' })
export class SessionStateRegistry {
  private readonly resetters = new Set<SessionStateResetter>();
  private readonly _generation = signal(0);

  readonly generation = this._generation.asReadonly();

  registerResetter(resetter: SessionStateResetter): void {
    this.resetters.add(resetter);
  }

  resetAll(): void {
    this._generation.update((value) => value + 1);

    for (const reset of this.resetters) {
      reset();
    }
  }

  captureGeneration(): number {
    return this._generation();
  }

  isCurrentGeneration(generation: number): boolean {
    return this._generation() === generation;
  }
}
