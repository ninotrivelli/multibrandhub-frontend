import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PosShellComponent } from '../../shared/pos/pos-shell.component';

@Component({
  selector: 'app-seller-pos',
  imports: [PosShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-pos-shell />`,
})
export class SellerPosComponent {}
