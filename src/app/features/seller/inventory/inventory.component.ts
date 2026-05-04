import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-seller-inventory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-semibold text-surface-900 dark:text-surface-0">Inventario</h1>
    <p class="text-surface-500 dark:text-surface-400 mt-1">Stock del local</p>
  `
})
export class SellerInventoryComponent {}
