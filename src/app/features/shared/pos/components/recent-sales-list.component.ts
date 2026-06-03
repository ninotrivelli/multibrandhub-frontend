import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, catchError, switchMap } from 'rxjs';

import { SelectModule } from 'primeng/select';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { LucideAngularModule, History } from 'lucide-angular';

import { BrandsService } from '../../../../core/brands/brands.service';
import { BrandResponse } from '../../../../core/brands/brands.types';
import { SalesService } from '../../../../core/sales/sales.service';
import { formatCurrencyUYU, parseBackendUtcDate, URUGUAY_TIME_ZONE } from '../../inventory/inventory.utils';

@Component({
  selector: 'app-pos-recent-sales-list',
  imports: [FormsModule, SelectModule, TableModule, TagModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recent-sales-list.component.html',
})
export class RecentSalesListComponent {
  private readonly sales = inject(SalesService);
  private readonly brands = inject(BrandsService);

  protected readonly icons = { History };

  protected readonly items = this.sales.recentItems;
  protected readonly totalCount = this.sales.recentTotal;
  protected readonly loading = this.sales.recentLoading;

  protected readonly brandId = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly brandOptions = computed(() => [
    { label: 'Todas las marcas', value: null },
    ...this.brands
      .items()
      .filter((b: BrandResponse) => b.status === 'Active')
      .map((b: BrandResponse) => ({ label: b.name, value: b.id as string | null })),
  ]);

  private readonly fetchTrigger$ = new Subject<void>();

  constructor() {
    this.fetchTrigger$
      .pipe(
        switchMap(() =>
          this.sales
            .search({
              brandId: this.brandId() ?? undefined,
              page: this.page(),
              pageSize: this.pageSize(),
            })
            .pipe(catchError(() => EMPTY)),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Initial load + refetch when the brand filter changes.
    effect(() => {
      this.brandId();
      untracked(() => {
        this.page.set(1);
        this.fetchTrigger$.next();
      });
    });
  }

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const newPageSize = event.rows ?? 10;
    const newPage = Math.floor((event.first ?? 0) / newPageSize) + 1;
    this.pageSize.set(newPageSize);
    this.page.set(newPage);
    this.fetchTrigger$.next();
  }

  protected formatTime(iso: string): string {
    return new Intl.DateTimeFormat('es-UY', {
      timeZone: URUGUAY_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
    }).format(parseBackendUtcDate(iso));
  }

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }

  // Re-runs the current query so a just-created sale/return shows up.
  refresh(): void {
    this.fetchTrigger$.next();
  }
}
