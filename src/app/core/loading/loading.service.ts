import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly counter = signal(0);

  readonly isLoading = computed(() => this.counter() > 0);

  start(): void {
    this.counter.update((n) => n + 1);
  }

  stop(): void {
    this.counter.update((n) => Math.max(0, n - 1));
  }
}
