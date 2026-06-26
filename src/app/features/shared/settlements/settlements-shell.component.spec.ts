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
});
