import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

import { BrandStyle, brandChipColors } from '../../../core/brands/brand-colors';

export type BrandChipSize = 'xs' | 'sm';

@Component({
  selector: 'app-brand-chip',
  imports: [TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brand-chip.component.html',
  host: {
    class: 'inline-flex max-w-full align-middle',
  },
})
export class BrandChipComponent {
  readonly brandId = input<string | null | undefined>(null);
  readonly brandName = input<string | null | undefined>(null);
  readonly size = input<BrandChipSize>('sm');

  protected readonly label = computed(() => this.brandName()?.trim() || 'Sin marca');

  protected readonly chipStyle = computed<BrandStyle>(() => {
    const colors = brandChipColors({
      brandId: this.brandId(),
      brandName: this.label(),
    });
    const compact = this.size() === 'xs';

    return {
      'background-color': colors.background,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      'border-radius': '999px',
      'font-size': compact ? '0.625rem' : '0.75rem',
      'font-weight': '700',
      'letter-spacing': '0',
      'line-height': '1',
      'max-width': '100%',
      padding: compact ? '0.1875rem 0.4375rem' : '0.25rem 0.5625rem',
      'text-transform': 'none',
      'white-space': 'nowrap',
    };
  });
}
