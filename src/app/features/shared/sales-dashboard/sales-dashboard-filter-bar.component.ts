import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { LucideAngularModule, Filter, Lock } from 'lucide-angular';

import { BrandResponse } from '../../../core/brands/brands.types';
import { BrandChipComponent } from '../../../shared/components/brand-chip/brand-chip.component';
import {
  SalesDashboardPeriodPreset,
  SalesDashboardVariant,
  formatRangeSummary,
  periodOptionsForCurrentYear,
} from './sales-dashboard.utils';

@Component({
  selector: 'app-sales-dashboard-filter-bar',
  imports: [
    FormsModule,
    InputTextModule,
    SelectModule,
    TagModule,
    LucideAngularModule,
    BrandChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-dashboard-filter-bar.component.html',
})
export class SalesDashboardFilterBarComponent {
  readonly variant = input.required<SalesDashboardVariant>();
  readonly brands = input.required<BrandResponse[]>();
  readonly selectedBrandIds = input.required<string[]>();
  readonly ownBrandId = input<string | null>(null);
  readonly periodPreset = input.required<SalesDashboardPeriodPreset>();
  readonly startDate = input.required<string>();
  readonly endDate = input.required<string>();

  readonly periodPresetChange = output<SalesDashboardPeriodPreset>();
  readonly startDateChange = output<string>();
  readonly endDateChange = output<string>();
  readonly allBrandsSelected = output<void>();
  readonly brandToggled = output<string>();

  protected readonly icons = { Filter, Lock };
  protected readonly formatRangeSummary = formatRangeSummary;
  protected readonly periodOptions = periodOptionsForCurrentYear();

  protected readonly activeBrands = computed(() =>
    this.brands().filter((brand) => brand.status === 'Active'),
  );

  protected readonly ownBrand = computed(() => {
    const ownId = this.ownBrandId();
    return ownId ? this.brands().find((brand) => brand.id === ownId) ?? null : null;
  });

  protected readonly selectedBrandNames = computed(() => {
    if (this.variant() === 'brand-manager') {
      return this.ownBrand()?.name ?? 'tu marca';
    }

    const ids = this.selectedBrandIds();
    if (ids.length === 0) return 'todas las marcas';

    const names = ids
      .map((id) => this.brands().find((brand) => brand.id === id)?.name)
      .filter((name): name is string => !!name);

    if (names.length === 0) return 'las marcas seleccionadas';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} y ${names[1]}`;

    return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  });

  protected readonly summary = computed(
    () =>
      `Mostrando ventas y devoluciones del ${formatRangeSummary(
        this.startDate(),
        this.endDate(),
      )}. Marcas seleccionadas: ${this.selectedBrandNames()}.`,
  );

  protected isBrandSelected(brandId: string): boolean {
    return this.selectedBrandIds().includes(brandId);
  }

  protected chipClasses(active: boolean): string {
    const base =
      'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
    return active
      ? `${base} bg-primary text-primary-contrast border border-primary shadow-sm`
      : `${base} bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-300 border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-surface-800 dark:hover:text-surface-100`;
  }
}
