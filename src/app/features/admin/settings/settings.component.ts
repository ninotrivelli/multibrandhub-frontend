import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { TabsModule } from 'primeng/tabs';

import { AdminAjustesGeneralesComponent } from './ajustes-generales/ajustes-generales.component';
import { AdminEquipoComponent } from './equipo/equipo.component';
import { AdminMarcasComponent } from './marcas/marcas.component';
import { AdminSeguridadComponent } from './seguridad/seguridad.component';

type SettingsTab = 'marcas' | 'equipo' | 'ajustes' | 'seguridad';

const VALID_TABS: SettingsTab[] = ['marcas', 'equipo', 'ajustes', 'seguridad'];
const DEFAULT_TAB: SettingsTab = 'equipo';

@Component({
  selector: 'app-admin-settings',
  imports: [
    TabsModule,
    AdminAjustesGeneralesComponent,
    AdminEquipoComponent,
    AdminMarcasComponent,
    AdminSeguridadComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
})
export class AdminSettingsComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly activeTab = computed<SettingsTab>(() => {
    const param = this.queryParams().get('tab');
    return VALID_TABS.includes(param as SettingsTab) ? (param as SettingsTab) : DEFAULT_TAB;
  });

  protected onTabChange(value: string | number): void {
    const tab = value as SettingsTab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }
}
