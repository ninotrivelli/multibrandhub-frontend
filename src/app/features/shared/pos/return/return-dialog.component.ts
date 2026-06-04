import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { LucideAngularModule, ArrowLeft, Minus, Plus, Search } from 'lucide-angular';

import { SalesService } from '../../../../core/sales/sales.service';
import { SaleResponse, SaleSearchResponse } from '../../../../core/sales/sales.types';
import {
  formatCurrencyUYU,
  parseBackendUtcDate,
  URUGUAY_TIME_ZONE,
} from '../../inventory/inventory.utils';

type Step = 'search' | 'detail';

@Component({
  selector: 'app-pos-return-dialog',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TagModule,
    TextareaModule,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './return-dialog.component.html',
})
export class ReturnDialogComponent {
  private readonly sales = inject(SalesService);

  readonly visible = input.required<boolean>();
  readonly visibleChange = output<boolean>();
  readonly saved = output<SaleResponse>();

  protected readonly icons = { Search, ArrowLeft, Minus, Plus };
  protected readonly maxObservations = 500;

  protected readonly step = signal<Step>('search');
  protected readonly searchTerm = signal('');
  protected readonly searching = signal(false);
  protected readonly selectedSale = signal<SaleResponse | null>(null);
  protected readonly loadingDetail = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly observations = signal('');

  // Quantity to return per sale-detail line id. Defaults to 0 for every line.
  // Keyed by the detail line (not the product) so a product sold across two
  // lines with different discounts is returned against the exact line.
  private readonly returnQuantities = signal<Record<string, number>>({});

  // Live original-sale search. Only completed sales (not returns) are
  // returnable, so we filter those out of the picker.
  private readonly searchResults$ = toObservable(this.searchTerm).pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap((term) => {
      if (!term || term.trim().length < 2) {
        this.searching.set(false);
        return of([] as SaleSearchResponse[]);
      }
      this.searching.set(true);
      return this.sales
        .searchOnce({ searchTerm: term, page: 1, pageSize: 10 })
        .pipe(
          map((res) =>
            res.items.filter((s) => s.type === 'Sale' && s.status === 'Completed'),
          ),
        );
    }),
  );

  protected readonly searchResults = toSignal(this.searchResults$, { initialValue: [] });

  protected readonly returnTotal = computed(() => {
    const sale = this.selectedSale();
    if (!sale) return 0;
    const qty = this.returnQuantities();
    // Refund the net unit price (after the original discount), matching what the
    // backend credits from the original detail snapshot.
    return sale.details.reduce(
      (sum, d) => sum + d.unitNetPrice * (qty[d.id] ?? 0),
      0,
    );
  });

  protected readonly hasReturnItems = computed(() =>
    Object.values(this.returnQuantities()).some((q) => q > 0),
  );

  protected readonly canSubmit = computed(() => this.hasReturnItems() && !this.submitting());

  constructor() {
    effect(() => {
      const open = this.visible();
      if (open) untracked(() => this.reset());
    });

    // Drop the search spinner once results land.
    effect(() => {
      this.searchResults();
      untracked(() => this.searching.set(false));
    });
  }

  protected onVisibleChange(value: boolean): void {
    if (!value && this.submitting()) return;
    this.visibleChange.emit(value);
  }

  protected cancel(): void {
    this.visibleChange.emit(false);
  }

  protected selectSale(sale: SaleSearchResponse): void {
    this.loadingDetail.set(true);
    this.submitError.set(null);
    this.sales.getById(sale.id).subscribe({
      next: (full) => {
        this.selectedSale.set(full);
        this.returnQuantities.set({});
        this.step.set('detail');
        this.loadingDetail.set(false);
      },
      error: () => this.loadingDetail.set(false),
    });
  }

  protected backToSearch(): void {
    this.step.set('search');
    this.selectedSale.set(null);
    this.returnQuantities.set({});
    this.submitError.set(null);
  }

  protected returnQty(detailId: string): number {
    return this.returnQuantities()[detailId] ?? 0;
  }

  protected setReturnQty(detailId: string, value: number, max: number): void {
    const qty = clamp(Math.round(value || 0), 0, max);
    this.returnQuantities.update((curr) => ({ ...curr, [detailId]: qty }));
  }

  protected submit(): void {
    const sale = this.selectedSale();
    if (!sale || !this.canSubmit()) return;

    const qty = this.returnQuantities();
    const details = sale.details
      .filter((d) => (qty[d.id] ?? 0) > 0)
      .map((d) => ({ originalSaleDetailId: d.id, quantity: qty[d.id] }));

    if (details.length === 0) return;

    this.submitError.set(null);
    this.submitting.set(true);
    const observations = this.observations().trim();

    this.sales
      .createReturn({
        originalSaleId: sale.id,
        details,
        observations: observations.length > 0 ? observations : null,
      })
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.saved.emit(created);
          this.visibleChange.emit(false);
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          const body = err.error as { message?: string; errors?: { message: string }[] } | undefined;
          if (body?.errors?.length) {
            this.submitError.set(body.errors.map((e) => e.message).join(' • '));
          } else if (body?.message) {
            this.submitError.set(body.message);
          } else {
            this.submitError.set('No se pudo registrar la devolución. Probá de nuevo.');
          }
        },
      });
  }

  protected formatCurrency(value: number): string {
    return formatCurrencyUYU(value);
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('es-UY', {
      timeZone: URUGUAY_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parseBackendUtcDate(iso));
  }

  private reset(): void {
    this.step.set('search');
    this.searchTerm.set('');
    this.searching.set(false);
    this.selectedSale.set(null);
    this.returnQuantities.set({});
    this.observations.set('');
    this.submitError.set(null);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
