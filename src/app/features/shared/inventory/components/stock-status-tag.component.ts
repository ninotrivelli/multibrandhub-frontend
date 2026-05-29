import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

import { computeStockStatus } from '../inventory.utils';

@Component({
  selector: 'app-stock-status-tag',
  imports: [TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-tag
      [value]="status()"
      [severity]="severity()"
      styleClass="!text-xs !font-semibold !px-2 !py-1 uppercase"
    />
  `,
})
export class StockStatusTagComponent {
  readonly stock = input.required<number>();
  readonly minAlert = input.required<number>();

  protected readonly status = computed(() => computeStockStatus(this.stock(), this.minAlert()));

  protected readonly severity = computed<'success' | 'warn' | 'danger'>(() => {
    const s = this.status();
    if (s === 'OK') return 'success';
    if (s === 'Crítico') return 'warn';
    return 'danger';
  });
}
