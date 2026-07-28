import { Signal, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { makeAuthUser, makeBrand, makeSettlement, paged } from '../../../../testing/builders';
import { primeNgTestProviders } from '../../../../testing/primeng-test-providers';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthUser } from '../../../core/auth/auth.types';
import { BrandsService } from '../../../core/brands/brands.service';
import { BrandResponse } from '../../../core/brands/brands.types';
import { NotificationService } from '../../../core/notifications/notification.service';
import { SettlementsService } from '../../../core/settlements/settlements.service';
import { SavedBrandSettlementSearchRequest } from '../../../core/settlements/settlements.types';
import { SettlementsShellComponent } from './settlements-shell.component';

describe('SettlementsShellComponent', () => {
  let fixture: ComponentFixture<SettlementsShellComponent>;
  let component: SettlementsShellComponent;
  let currentUser: WritableSignal<AuthUser | null>;
  let brandItems: WritableSignal<BrandResponse[]>;
  let brands: {
    items: Signal<BrandResponse[]>;
    loading: Signal<boolean>;
    hasItems: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let settlements: {
    searchSaved: ReturnType<typeof vi.fn>;
    getSavedById: ReturnType<typeof vi.fn>;
    getVersions: ReturnType<typeof vi.fn>;
    generate: ReturnType<typeof vi.fn>;
    finalize: ReturnType<typeof vi.fn>;
    markPaid: ReturnType<typeof vi.fn>;
  };
  let notifications: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });

    currentUser = signal<AuthUser | null>(makeAuthUser({ role: 'Admin', brandId: 'brand-own' }));
    brandItems = signal<BrandResponse[]>([
      makeBrand({ id: 'brand-own', name: 'Zendra' }),
      makeBrand({ id: 'brand-a', name: 'Lumina' }),
    ]);

    brands = {
      items: brandItems.asReadonly(),
      loading: signal(false).asReadonly(),
      hasItems: vi.fn(() => true),
      list: vi.fn(() => of(paged(brandItems()))),
    };

    settlements = {
      searchSaved: vi.fn((request: SavedBrandSettlementSearchRequest) =>
        of(paged([makeSettlement({ brandId: request.brandId ?? 'brand-a' })])),
      ),
      getSavedById: vi.fn(() => of(makeSettlement())),
      getVersions: vi.fn(() => of([makeSettlement()])),
      generate: vi.fn(() => of([makeSettlement()])),
      finalize: vi.fn(() => of(makeSettlement())),
      markPaid: vi.fn(() => of(makeSettlement())),
    };
    notifications = {
      success: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [SettlementsShellComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: currentUser.asReadonly(),
          },
        },
        {
          provide: BrandsService,
          useValue: brands,
        },
        {
          provide: SettlementsService,
          useValue: settlements,
        },
        {
          provide: NotificationService,
          useValue: notifications,
        },
      ],
    });

    await TestBed.compileComponents();
  });

  function create(variant: 'admin' | 'brand-manager'): void {
    fixture = TestBed.createComponent(SettlementsShellComponent);
    fixture.componentRef.setInput('variant', variant);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('loads Admin saved settlements for the current month without superseded versions by default', () => {
    create('admin');

    const firstRequest = settlements.searchSaved.mock.calls[0]![0];
    expect(firstRequest.from?.endsWith('-01')).toBe(true);
    expect(firstRequest.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(firstRequest.includeSuperseded).toBe(false);
    expect(firstRequest.page).toBe(1);
    expect(firstRequest.pageSize).toBe(20);
    expect(firstRequest.brandId).toBeUndefined();
  });

  it('switches the Admin generate label to Recalcular when an exact current settlement exists', () => {
    create('admin');

    (component as any).selectedBrandId.set('brand-a');
    TestBed.flushEffects();
    (component as any).existingCurrentForSelectedBrand.set(null);
    expect((component as any).generateButtonLabel()).toBe('Generar');

    (component as any).existingCurrentForSelectedBrand.set(
      makeSettlement({
        brandId: 'brand-a',
        from: `${(component as any).startDate()}T00:00:00`,
        to: `${(component as any).endDate()}T00:00:00`,
        isCurrent: true,
      }),
    );
    expect((component as any).generateButtonLabel()).toBe('Recalcular');
  });

  it('gates Admin row actions by operational status and current version', () => {
    create('admin');

    expect((component as any).canFinalize(makeSettlement({ status: 'Draft' }))).toBe(true);
    expect((component as any).canMarkPaid(makeSettlement({ status: 'Finalized' }))).toBe(true);
    expect(
      (component as any).canFinalize(makeSettlement({ status: 'Draft', isCurrent: false })),
    ).toBe(false);
    expect((component as any).canMarkPaid(makeSettlement({ status: 'Paid' }))).toBe(false);
  });

  it('scopes BrandManager searches to their own brand and keeps mutations read-only', () => {
    currentUser.set(makeAuthUser({ role: 'BrandManager', brandId: 'brand-a' }));

    create('brand-manager');

    expect(settlements.searchSaved.mock.calls[0]![0].brandId).toBe('brand-a');
    expect((component as any).canFinalize(makeSettlement({ status: 'Draft' }))).toBe(false);
    expect((component as any).canMarkPaid(makeSettlement({ status: 'Finalized' }))).toBe(false);
  });

  it('renders financial direction copy and color classes from settlement status', () => {
    create('admin');

    expect((component as any).directionLabel('BrandOwesStore')).toBe(
      'La marca debe pagar al local',
    );
    expect((component as any).directionLabel('StoreOwesBrand')).toBe(
      'El local debe transferir a la marca',
    );
    expect((component as any).directionLabel('BreakEven')).toBe('Liquidación saldada');
    expect((component as any).directionAmountClasses('BrandOwesStore')).toContain('amber');
    expect((component as any).directionAmountClasses('StoreOwesBrand')).toContain('blue');
  });

  it('explains commission, collection context, and final balance formulas', () => {
    create('admin');
    const settlement = makeSettlement({
      grossSalesAmount: 25683,
      returnsAmount: 502,
      netSalesAmount: 25181,
      commissionPercentage: 18,
      commissionAmount: 4533,
      fixedAmount: 0,
      platformFee: 4533,
      cashCollectedByStore: 11481,
      nonCashCollectedByBrand: 13700,
      amountBrandOwesStore: -6948,
      settlementStatus: 'StoreOwesBrand',
    });

    expect(normalizeSpaces((component as any).commissionFormula(settlement))).toBe(
      '18% de $ 25.181 = $ 4.533',
    );
    expect(normalizeSpaces((component as any).nonCashFormula(settlement))).toBe(
      '$ 25.181 - $ 11.481 = $ 13.700',
    );
    expect(normalizeSpaces((component as any).balanceFormula(settlement))).toBe(
      '$ 4.533 - $ 11.481 = -$ 6.948',
    );
    expect((component as any).balanceExplanation(settlement)).toContain(
      'más efectivo que su total a cobrar',
    );
  });

  it('prefills the mark-paid date with the current local datetime when opening the dialog', () => {
    create('admin');

    (component as any).openMarkPaid(makeSettlement({ status: 'Finalized', isCurrent: true }));

    const paidAtLocal = (component as any).paidAtLocal() as string;
    expect(paidAtLocal).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect((component as any).markPaidDialogVisible()).toBe(true);
  });

  it('keeps backend grouped order and tags rows with generation batch keys', () => {
    create('admin');

    (component as any).includeSuperseded.set(true);
    (component as any).saved.set(
      paged([
        makeSettlement({
          id: 'a2',
          brandName: 'Aurora',
          seriesId: 'sa',
          versionNumber: 2,
          isCurrent: true,
          generationBatchId: 'batch-v2',
        }),
        makeSettlement({
          id: 'b2',
          brandName: 'Bohemia',
          seriesId: 'sb',
          versionNumber: 2,
          isCurrent: true,
          generationBatchId: 'batch-v2',
        }),
        makeSettlement({
          id: 'a1',
          brandName: 'Aurora',
          seriesId: 'sa',
          versionNumber: 1,
          isCurrent: false,
          generationBatchId: 'batch-v1',
        }),
        makeSettlement({
          id: 'b1',
          brandName: 'Bohemia',
          seriesId: 'sb',
          versionNumber: 1,
          isCurrent: false,
          generationBatchId: 'batch-v1',
        }),
      ]),
    );

    const rows = (component as any).tableRows() as Array<{
      id: string;
      generationGroupKey: string;
    }>;
    const ids = rows.map((row) => row.id);
    expect(ids).toEqual(['a2', 'b2', 'a1', 'b1']);
    expect(rows.map((row) => row.generationGroupKey)).toEqual([
      'batch:batch-v2',
      'batch:batch-v2',
      'batch:batch-v1',
      'batch:batch-v1',
    ]);
  });

  it('uses grouped backend totalPages for the historical paginator', () => {
    create('admin');

    (component as any).includeSuperseded.set(true);
    (component as any).pageSize.set(20);
    (component as any).saved.set({
      items: [makeSettlement()],
      totalCount: 56,
      page: 1,
      pageSize: 20,
      totalPages: 4,
      totalGroups: 8,
    });

    expect((component as any).tablePaginatorTotalRecords()).toBe(80);
    expect((component as any).pageReportTemplate()).toBe('Página {currentPage} de {totalPages}');
  });

  it('uses row totals and row-range copy for current-only pagination', () => {
    create('admin');

    (component as any).includeSuperseded.set(false);
    (component as any).saved.set({
      items: [makeSettlement()],
      totalCount: 56,
      page: 1,
      pageSize: 20,
      totalPages: 3,
    });

    expect((component as any).tablePaginatorTotalRecords()).toBe(56);
    expect((component as any).pageReportTemplate()).toBe(
      'Mostrando {first} a {last} de {totalRecords} liquidaciones',
    );
  });

  it('builds a sanitized PDF filename from brand, period start and version', () => {
    create('admin');

    const name = (component as any).printFileName(
      makeSettlement({ brandName: 'Kora Accesorios', from: '2026-06-01T00:00:00', versionNumber: 3 }),
    );
    expect(name).toBe('Liquidacion_Kora-Accesorios_2026-06-01_v3');
  });

  it('builds a combined version tag label from version number and current flag', () => {
    create('admin');

    expect(
      (component as any).versionTagLabel(makeSettlement({ versionNumber: 2, isCurrent: true })),
    ).toBe('v2 · Vigente');
    expect(
      (component as any).versionTagLabel(makeSettlement({ versionNumber: 1, isCurrent: false })),
    ).toBe('v1 · Anterior');
  });

  it('sorts brand options, marks archived brands and resolves the selected brand', () => {
    brandItems.set([
      makeBrand({ id: 'z', name: 'Zafiro' }),
      makeBrand({ id: 'a', name: 'Ámbar', status: 'Archived' }),
    ]);
    create('admin');

    expect((component as any).brandOptions()).toEqual([
      { label: 'Ámbar (dada de baja)', value: 'a' },
      { label: 'Zafiro', value: 'z' },
    ]);

    (component as any).onBrandFilterChange('z');
    expect((component as any).selectedBrand()).toEqual(expect.objectContaining({ id: 'z' }));
    expect((component as any).page()).toBe(1);
  });

  it('applies period, status, superseded and lazy pagination filters', () => {
    create('admin');

    (component as any).setPeriodPreset('previousMonth');
    expect((component as any).periodPreset()).toBe('previousMonth');

    (component as any).setCustomStartDate('2026-07-20');
    (component as any).setCustomEndDate('2026-07-10');
    (component as any).onStatusFilterChange('Finalized');
    (component as any).onIncludeSupersededChange(true);
    (component as any).onLazyLoad({ first: 40, rows: 20 });

    expect((component as any).periodPreset()).toBe('custom');
    expect((component as any).startDate()).toBe('2026-07-10');
    expect((component as any).endDate()).toBe('2026-07-20');
    expect((component as any).selectedStatus()).toBe('Finalized');
    expect((component as any).includeSuperseded()).toBe(true);
    expect((component as any).page()).toBe(3);

    const before = (component as any).startDate();
    (component as any).setCustomStartDate('');
    (component as any).setCustomEndDate('');
    expect((component as any).startDate()).toBe(before);
  });

  it('handles missing BrandManager scope without sending a search', () => {
    currentUser.set(makeAuthUser({ role: 'BrandManager', brandId: null }));
    create('brand-manager');

    expect((component as any).missingBrandScope()).toBe(true);
    expect((component as any).currentRequest()).toBeNull();
    expect(settlements.searchSaved).not.toHaveBeenCalled();

    (component as any).refresh();
    expect(settlements.searchSaved).not.toHaveBeenCalled();
  });

  it('loads brands when the cache is empty and tolerates its backend error', () => {
    brands.hasItems.mockReturnValue(false);
    brands.list.mockReturnValue(throwError(() => new Error('network')));

    create('admin');

    expect(brands.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      includeArchived: true,
    });
  });

  it('exposes saved-search failures and resets loading', () => {
    settlements.searchSaved.mockReturnValue(throwError(() => new Error('network')));

    create('admin');

    expect((component as any).error()).toBe(
      'No se pudieron cargar las liquidaciones. Probá de nuevo.',
    );
    expect((component as any).loading()).toBe(false);
  });

  it('generates a settlement with normalized notes and refreshes the list', () => {
    settlements.generate.mockReturnValue(of([makeSettlement(), makeSettlement({ id: 's2' })]));
    create('admin');
    settlements.searchSaved.mockClear();

    (component as any).openGenerateDialog();
    (component as any).generateNotes.set('  Cierre mensual  ');
    (component as any).confirmGenerate();

    expect(settlements.generate).toHaveBeenCalledWith({
      from: (component as any).startDate(),
      to: (component as any).endDate(),
      brandId: undefined,
      notes: 'Cierre mensual',
    });
    expect((component as any).generateDialogVisible()).toBe(false);
    expect((component as any).generating()).toBe(false);
    expect(notifications.success).toHaveBeenCalledWith(
      'Se generaron/recalcularon 2 liquidaciones.',
    );
    expect(settlements.searchSaved).toHaveBeenCalled();
  });

  it('guards generation by role and keeps the dialog locked while submitting', () => {
    currentUser.set(makeAuthUser({ role: 'BrandManager', brandId: 'brand-a' }));
    create('brand-manager');

    (component as any).openGenerateDialog();
    (component as any).confirmGenerate();
    expect((component as any).generateDialogVisible()).toBe(false);
    expect(settlements.generate).not.toHaveBeenCalled();

    (component as any).generating.set(true);
    (component as any).onGenerateDialogVisibleChange(false);
    expect((component as any).generateDialogVisible()).toBe(false);
  });

  it('opens details, loads versions and resets the complete detail state on close', () => {
    const current = makeSettlement({ id: 'current' });
    const previous = makeSettlement({ id: 'previous', isCurrent: false });
    settlements.getSavedById.mockReturnValue(of(current));
    settlements.getVersions.mockReturnValue(of([current, previous]));
    create('admin');

    (component as any).openDetail(current);
    expect((component as any).selectedSettlement()).toEqual(current);
    expect((component as any).detailVisible()).toBe(true);

    (component as any).toggleVersions();
    expect(settlements.getVersions).toHaveBeenCalledWith('current');
    expect((component as any).versions()).toEqual([current, previous]);
    expect((component as any).versionsVisible()).toBe(true);

    (component as any).selectVersion(previous);
    expect((component as any).selectedSettlement()).toEqual(previous);

    (component as any).onDetailVisibleChange(false);
    expect((component as any).selectedSettlement()).toBeNull();
    expect((component as any).versions()).toBeNull();
    expect((component as any).versionsVisible()).toBe(false);
  });

  it('reports detail and version request failures', () => {
    settlements.getSavedById.mockReturnValue(throwError(() => new Error('detail')));
    settlements.getVersions.mockReturnValue(throwError(() => new Error('versions')));
    create('admin');

    (component as any).openDetail(makeSettlement({ id: 'broken' }));
    expect((component as any).detailError()).toBe(
      'No se pudo cargar el detalle de la liquidación.',
    );
    expect((component as any).detailLoading()).toBe(false);

    (component as any).selectedSettlement.set(makeSettlement({ id: 'broken' }));
    (component as any).toggleVersions();
    expect(notifications.error).toHaveBeenCalledWith('No se pudieron cargar las versiones.');
    expect((component as any).versionsLoading()).toBe(false);
  });

  it('finalizes an eligible row and updates an opened detail', () => {
    const draft = makeSettlement({ id: 'draft', status: 'Draft', isCurrent: true });
    const finalized = makeSettlement({ id: 'draft', status: 'Finalized', isCurrent: true });
    settlements.finalize.mockReturnValue(of(finalized));
    create('admin');
    settlements.searchSaved.mockClear();
    (component as any).selectedSettlement.set(draft);

    (component as any).finalize(draft);

    expect(settlements.finalize).toHaveBeenCalledWith('draft');
    expect((component as any).mutatingSettlementId()).toBeNull();
    expect((component as any).selectedSettlement()).toEqual(finalized);
    expect(notifications.success).toHaveBeenCalledWith(
      'La liquidación quedó finalizada.',
      'Liquidación finalizada',
    );
    expect(settlements.searchSaved).toHaveBeenCalled();
  });

  it('clears mutation state when finalization fails and rejects ineligible rows', () => {
    settlements.finalize.mockReturnValue(throwError(() => new Error('network')));
    create('admin');
    const draft = makeSettlement({ id: 'draft', status: 'Draft', isCurrent: true });

    (component as any).finalize(draft);
    expect((component as any).mutatingSettlementId()).toBeNull();

    (component as any).finalize(makeSettlement({ status: 'Paid' }));
    expect(settlements.finalize).toHaveBeenCalledTimes(1);
  });

  it('marks a finalized settlement as paid with normalized optional values', () => {
    const target = makeSettlement({ id: 'final', status: 'Finalized', isCurrent: true });
    const paid = makeSettlement({ id: 'final', status: 'Paid', isCurrent: true });
    settlements.markPaid.mockReturnValue(of(paid));
    create('admin');

    (component as any).openMarkPaid(target);
    (component as any).paidAtLocal.set('2026-07-27T16:45');
    (component as any).paymentReference.set('  TRANS-123  ');
    (component as any).paymentNotes.set('   ');
    (component as any).confirmMarkPaid();

    expect(settlements.markPaid).toHaveBeenCalledWith('final', {
      paymentReference: 'TRANS-123',
      notes: null,
      paidAtUtc: new Date('2026-07-27T16:45').toISOString(),
    });
    expect((component as any).markPaidDialogVisible()).toBe(false);
    expect((component as any).markPaidTarget()).toBeNull();
    expect(notifications.success).toHaveBeenCalledWith(
      'La liquidación quedó marcada como pagada.',
      'Pago registrado',
    );
  });

  it('validates payment lengths and clears payment state after backend errors', () => {
    const target = makeSettlement({ id: 'final', status: 'Finalized', isCurrent: true });
    settlements.markPaid.mockReturnValue(throwError(() => new Error('network')));
    create('admin');
    (component as any).openMarkPaid(target);

    (component as any).paymentReference.set('x'.repeat(101));
    expect((component as any).canConfirmMarkPaid()).toBe(false);
    (component as any).confirmMarkPaid();
    expect(settlements.markPaid).not.toHaveBeenCalled();

    (component as any).paymentReference.set('');
    (component as any).paymentNotes.set('');
    (component as any).paidAtLocal.set('');
    (component as any).confirmMarkPaid();
    expect(settlements.markPaid).toHaveBeenCalledWith('final', {
      paymentReference: null,
      notes: null,
    });
    expect((component as any).markingPaid()).toBe(false);
  });

  it('covers presentation helpers and financial balance explanations', () => {
    create('admin');
    const positive = makeSettlement({ amountBrandOwesStore: 10 });
    const neutral = makeSettlement({ amountBrandOwesStore: 0 });

    expect((component as any).statusLabel('Draft')).toBe('Borrador');
    expect((component as any).statusSeverity('Finalized')).toBe('info');
    expect((component as any).directionSeverity('BrandOwesStore')).toBe('warn');
    expect((component as any).formatCurrency(1234)).toContain('1.234');
    expect((component as any).formatAbsoluteCurrency(-1234)).toContain('1.234');
    expect((component as any).formatPercent(12.5)).toContain('12,5%');
    expect((component as any).platformFeeFormula(positive)).toContain('=');
    expect((component as any).balanceExplanation(positive)).toContain('La marca debe pagar');
    expect((component as any).balanceExplanation(neutral)).toContain('No queda saldo pendiente');
    expect((component as any).formatDateTime(null)).toBe('—');
    expect((component as any).formatDateTime('2026-07-27T12:00:00Z')).not.toBe('—');
    expect((component as any).periodLabel(positive)).toContain(' al ');
    expect((component as any).versionGroupLabel(positive)).toContain('Versión 1');
    expect((component as any).contractLabel(positive)).toBe('Mixto');
    expect((component as any).isMutating(positive)).toBe(false);
    expect((component as any).isOwnBrand('brand-own')).toBe(true);
  });

  it('computes the newest loaded generation time and legacy generation grouping', () => {
    create('admin');
    (component as any).saved.set(
      paged([
        makeSettlement({
          id: 'old',
          generatedAtUtc: '2026-06-01T10:00:00Z',
          generationBatchId: null,
        }),
        makeSettlement({
          id: 'new',
          generatedAtUtc: '2026-06-02T10:00:00Z',
          generationBatchId: null,
        }),
      ]),
    );

    expect((component as any).lastCalculatedAtUtc()).toBe('2026-06-02T10:00:00Z');
    expect((component as any).tableRows()[0].generationGroupKey).toContain('legacy:');

    (component as any).saved.set(null);
    expect((component as any).lastCalculatedAtUtc()).toBeNull();
    expect((component as any).tablePaginatorTotalRecords()).toBe(0);
  });
});

function normalizeSpaces(value: string): string {
  return value.replace(/\s/g, ' ');
}
