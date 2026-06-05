import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SalesDashboardShellComponent } from '../../shared/sales-dashboard/sales-dashboard-shell.component';

@Component({
  selector: 'app-admin-sales',
  imports: [SalesDashboardShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales.component.html',
})
export class AdminSalesComponent {}
