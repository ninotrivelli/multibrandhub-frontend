import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SettlementsShellComponent } from '../../shared/settlements/settlements-shell.component';

@Component({
  selector: 'app-admin-settlements',
  imports: [SettlementsShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settlements.component.html',
})
export class AdminSettlementsComponent {}
