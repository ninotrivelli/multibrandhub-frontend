import { Signal, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeAuthUser, makeBrand, makeSettlement, paged } from '../../../../testing/builders';
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

  beforeEach(async () => {
    TestBed.resetTestingModule();

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
          useValue: {
            success: vi.fn(),
            error: vi.fn(),
          },
        },
      ],
    });

    TestBed.overrideComponent(SettlementsShellComponent, { set: { template: '' } });
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
});

function normalizeSpaces(value: string): string {
  return value.replace(/\s/g, ' ');
}
