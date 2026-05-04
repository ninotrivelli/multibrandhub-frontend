import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-seller-pos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-semibold text-surface-900 dark:text-surface-0">Ingresar Venta</h1>
    <p class="text-surface-500 dark:text-surface-400 mt-1">Punto de venta unificado</p>
  `
})
export class SellerPosComponent {}
