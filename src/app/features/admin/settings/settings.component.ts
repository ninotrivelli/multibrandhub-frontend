import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { TabsModule } from 'primeng/tabs';

import { AdminAjustesGeneralesComponent } from './ajustes-generales/ajustes-generales.component';
import { AdminEquipoComponent } from './equipo/equipo.component';
import { AdminMarcasComponent } from './marcas/marcas.component';

type SettingsTab = 'marcas' | 'equipo' | 'ajustes';

const VALID_TABS: SettingsTab[] = ['marcas', 'equipo', 'ajustes'];
const DEFAULT_TAB: SettingsTab = 'equipo';

@Component({
  selector: 'app-admin-settings',
  imports: [TabsModule, AdminAjustesGeneralesComponent, AdminEquipoComponent, AdminMarcasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6">
      <h1 class="text-2xl font-semibold text-surface-900 dark:text-surface-0">Configuración</h1>
      <p class="text-surface-500 dark:text-surface-400 mt-1">Marcas, Equipo y Ajustes Generales</p>
    </header>

    <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event!)">
      <p-tablist>
        <p-tab value="marcas">Marcas Asociadas</p-tab>
        <p-tab value="equipo">Equipo</p-tab>
        <p-tab value="ajustes">Ajustes Generales</p-tab>
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="marcas">
          <app-admin-marcas />
        </p-tabpanel>
        <p-tabpanel value="equipo">
          <app-admin-equipo />
        </p-tabpanel>
        <p-tabpanel value="ajustes">
          <app-ajustes-generales />
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>
  `,
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
