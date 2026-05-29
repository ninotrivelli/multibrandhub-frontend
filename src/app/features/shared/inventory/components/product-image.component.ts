import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { categoryPlaceholderUrl } from '../inventory.utils';

type ImageSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-product-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden flex items-center justify-center shrink-0"
      [class.size-10]="size() === 'sm'"
      [class.size-14]="size() === 'md'"
      [class.size-20]="size() === 'lg'"
    >
      <img
        [src]="resolvedUrl()"
        [alt]="alt()"
        (error)="onImgError()"
        class="size-full object-cover"
      />
    </div>
  `,
})
export class ProductImageComponent {
  readonly imageUrl = input<string | null | undefined>(null);
  readonly categoryName = input<string | null | undefined>(null);
  readonly alt = input<string>('Producto');
  readonly size = input<ImageSize>('md');

  // Toggled if the resolved URL fails to load (e.g. broken Azure blob).
  // We then fall back to the category placeholder.
  protected readonly fallback = signal(false);

  protected readonly resolvedUrl = computed(() => {
    if (this.fallback()) return categoryPlaceholderUrl(this.categoryName());
    const url = this.imageUrl();
    if (url && url.trim().length > 0) return url;
    return categoryPlaceholderUrl(this.categoryName());
  });

  protected onImgError(): void {
    if (!this.fallback()) this.fallback.set(true);
  }
}
