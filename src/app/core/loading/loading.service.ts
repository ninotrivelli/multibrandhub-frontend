import { Injectable, computed, inject, signal } from '@angular/core';

import { SessionStateRegistry } from '../session/session-state-registry.service';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly sessionState = inject(SessionStateRegistry);
  private readonly counter = signal(0);

  readonly isLoading = computed(() => this.counter() > 0);

  constructor() {
    this.sessionState.registerResetter(() => this.counter.set(0));
  }

  start(): void {
    this.counter.update((n) => n + 1);
  }

  stop(): void {
    this.counter.update((n) => Math.max(0, n - 1));
  }
}
