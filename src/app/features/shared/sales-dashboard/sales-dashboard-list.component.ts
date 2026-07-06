import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { History, LucideAngularModule, LucideIconData } from 'lucide-angular';

import { BrandChipComponent } from '../../../shared/components/brand-chip/brand-chip.component';
import {
  CardBrand,
  PaymentMethod,
  PagedResult,
  SalesDashboardSaleResponse,
} from '../../../core/sales/sales.types';
import {
  cardBrandLabel,
  paymentMethodIcon,
  paymentMethodLabel,
  saleTypeStatusLabel,
  saleTypeStatusSeverity,
  type SaleTagSeverity,
} from '../../../core/sales/sales.utils';
import {
  formatCurrencyUYU,
  formatShortDate,
  parseBackendUtcDate,
  relativeDayLabel,
  URUGUAY_TIME_ZONE,
} from '../inventory/inventory.utils';
import { SaleDetailDialogComponent } from '../pos/components/sale-detail-dialog.component';
import { formatRangeSummary } from './sales-dashboard.utils';

@Component({
  selector: 'app-sales-dashboard-list',
  imports: [
    ButtonModule,
    TableModule,
    TagModule,
    LucideAngularModule,
    BrandChipComponent,
    SaleDetailDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-dashboard-list.component.html',
})
export class SalesDashboardListComponent {
  readonly sales = input<PagedResult<SalesDashboardSaleResponse> | null>(null);
  readonly loading = input(false);
  readonly page = input(1);
  readonly pageSize = input(10);
  readonly hasFilter = input(false);
  readonly detailBrandScopeId = input<string | null>(null);
  readonly allowSaleActions = input(false);
  readonly startDate = input.required<string>();
  readonly endDate = input.required<string>();

  readonly pageChange = output<{ page: number; pageSize: number }>();
  readonly saleChanged = output<string>();
  readonly returnRequested = output<string>();

  protected readonly icons = { History };
  protected readonly detailVisible = signal(false);
  protected readonly selectedSaleId = signal<string | null>(null);
  protected readonly rangeLabel = computed(() => formatRangeSummary(this.startDate(), this.endDate()));

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const nextPageSize = event.rows ?? 10;
    const nextPage = Math.floor((event.first ?? 0) / nextPageSize) + 1;
    this.pageChange.emit({ page: nextPage, pageSize: nextPageSize });
  }

  protected openDetail(row: SalesDashboardSaleResponse): void {
    this.selectedSaleId.set(row.id);
    this.detailVisible.set(true);
  }

  protected onDetailSaleChanged(id: string): void {
    this.saleChanged.emit(id);
  }

  protected onDetailReturnRequested(id: string): void {
    this.detailVisible.set(false);
    this.returnRequested.emit(id);
  }

  protected fullDate(iso: string): string {
    return formatShortDate(iso);
  }

  protected dayLabel(iso: string): 'Hoy' | 'Ayer' | null {
    return relativeDayLabel(iso);
  }

  protected formatTime(iso: string): string {
    return new Intl.DateTimeFormat('es-UY', {
      timeZone: URUGUAY_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(parseBackendUtcDate(iso));
  }

  protected paymentIcon(method: PaymentMethod): LucideIconData {
    return paymentMethodIcon(method);
  }

  protected paymentLabel(method: PaymentMethod): string {
    return paymentMethodLabel(method);
  }

  protected cardBrand(brand: CardBrand): string {
    return cardBrandLabel(brand);
  }

  protected typeStatusLabel(row: SalesDashboardSaleResponse): string {
    return saleTypeStatusLabel(row.type, row.status);
  }

  protected typeStatusSeverity(row: SalesDashboardSaleResponse): SaleTagSeverity {
    return saleTypeStatusSeverity(row.type, row.status);
  }

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }

  protected showTicketTotal(row: SalesDashboardSaleResponse): boolean {
    return !this.detailBrandScopeId() && row.ticketTotalAmount !== row.matchingAmount;
  }
}
