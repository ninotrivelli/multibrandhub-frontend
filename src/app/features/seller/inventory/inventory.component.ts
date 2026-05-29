import { ChangeDetectionStrategy, Component } from '@angular/core';

import { InventoryShellComponent } from '../../shared/inventory/inventory-shell.component';

@Component({
  selector: 'app-seller-inventory',
  imports: [InventoryShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-inventory-shell />`,
})
export class SellerInventoryComponent {}
