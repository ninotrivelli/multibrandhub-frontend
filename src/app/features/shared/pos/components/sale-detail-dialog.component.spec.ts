import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfirmationService } from 'primeng/api';

import { brandHeaderStyle } from '../../../../core/brands/brand-colors';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { SalesService } from '../../../../core/sales/sales.service';
import { makeSale, makeSaleDetail } from '../../../../../testing/builders';
import { primeNgTestProviders } from '../../../../../testing/primeng-test-providers';
import { SaleDetailDialogComponent } from './sale-detail-dialog.component';

describe('SaleDetailDialogComponent', () => {
  let fixture: ComponentFixture<SaleDetailDialogComponent>;
  let sales: { getById: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> };
  let notifications: { success: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });
    sales = {
      getById: vi.fn(() =>
        of(
          makeSale({
            details: [
              makeSaleDetail({ id: 'own-line', brandId: 'brand-own', brandName: 'Zendra' }),
              makeSaleDetail({
                id: 'other-line',
                brandId: 'brand-other',
                brandName: 'Lumina',
                productName: 'Top Lumina',
                subTotal: 1200,
              }),
            ],
          }),
        ),
      ),
      cancel: vi.fn(() => of(void 0)),
    };
    notifications = { success: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SaleDetailDialogComponent],
      providers: [
        { provide: SalesService, useValue: sales },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(SaleDetailDialogComponent);
    fixture.componentRef.setInput('visible', false);
  });

  it('groups only the scoped brand lines for Brand Manager detail views', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('saleId', 'sale-1');
    fixture.componentRef.setInput('brandScopeId', 'brand-own');
    fixture.detectChanges();

    const groups = (fixture.componentInstance as any).brandGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0].brandId).toBe('brand-own');
    expect(groups[0].brandName).toBe('Zendra');
    expect(groups[0].items.map((item: { id: string }) => item.id)).toEqual(['own-line']);
  });

  it('keeps brands with the same display name separated by brand id', () => {
    sales.getById.mockReturnValueOnce(
      of(
        makeSale({
          details: [
            makeSaleDetail({ id: 'line-a', brandId: 'brand-a', brandName: 'Zendra' }),
            makeSaleDetail({ id: 'line-b', brandId: 'brand-b', brandName: 'Zendra' }),
          ],
        }),
      ),
    );

    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('saleId', 'sale-same-name');
    fixture.detectChanges();

    const groups = (fixture.componentInstance as any).brandGroups();

    expect(groups).toHaveLength(2);
    expect(groups.map((group: { brandId: string }) => group.brandId)).toEqual([
      'brand-a',
      'brand-b',
    ]);
    expect(groups.map((group: { items: { id: string }[] }) => group.items[0].id)).toEqual([
      'line-a',
      'line-b',
    ]);
  });

  it('uses the same brand-id based header colors as brand chips', () => {
    const style = (fixture.componentInstance as any).brandGroupHeaderStyle('brand-own', 'Zendra');

    expect(style).toEqual(brandHeaderStyle({ brandId: 'brand-own', brandName: 'Zendra' }));
    expect(style).not.toEqual(brandHeaderStyle({ brandName: 'Zendra' }));
  });

  it('enables sale actions only for completed sales when allowed', () => {
    fixture.componentRef.setInput('allowSaleActions', true);
    fixture.detectChanges();

    (fixture.componentInstance as any).sale.set(makeSale({ type: 'Sale', status: 'Completed' }));
    expect((fixture.componentInstance as any).canOperateSale()).toBe(true);

    for (const sale of [
      makeSale({ type: 'Return', status: 'Completed' }),
      makeSale({ type: 'Sale', status: 'Canceled' }),
      makeSale({ type: 'Sale', status: 'Pending' }),
      makeSale({ type: 'Sale', status: 'Refunded' }),
    ]) {
      (fixture.componentInstance as any).sale.set(sale);
      expect((fixture.componentInstance as any).canOperateSale()).toBe(false);
    }

    fixture.componentRef.setInput('allowSaleActions', false);
    (fixture.componentInstance as any).sale.set(makeSale({ type: 'Sale', status: 'Completed' }));
    fixture.detectChanges();

    expect((fixture.componentInstance as any).canOperateSale()).toBe(false);
  });

  it('emits returnRequested with the selected sale id', () => {
    const spy = vi.fn();
    fixture.componentInstance.returnRequested.subscribe(spy);
    fixture.componentRef.setInput('allowSaleActions', true);
    (fixture.componentInstance as any).sale.set(
      makeSale({ id: 'sale-returnable', type: 'Sale', status: 'Completed' }),
    );
    fixture.detectChanges();

    (fixture.componentInstance as any).requestReturn();

    expect(spy).toHaveBeenCalledWith('sale-returnable');
  });

  it('confirms cancellation, calls the backend, emits saleChanged, and reloads detail', () => {
    const saleChanged = vi.fn();
    fixture.componentInstance.saleChanged.subscribe(saleChanged);
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    const confirmSpy = vi.spyOn(confirmation, 'confirm');

    sales.getById.mockReturnValue(of(makeSale({ id: 'sale-cancel', ticketId: 'TCK-1' })));
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('saleId', 'sale-cancel');
    fixture.componentRef.setInput('allowSaleActions', true);
    fixture.detectChanges();

    (fixture.componentInstance as any).confirmCancel();
    const confirmationOptions = confirmSpy.mock.calls[0]?.[0];
    confirmationOptions?.accept?.();

    expect(sales.cancel).toHaveBeenCalledWith('sale-cancel');
    expect(saleChanged).toHaveBeenCalledWith('sale-cancel');
    expect(notifications.success).toHaveBeenCalledWith(
      'La venta se anuló correctamente.',
      'Venta anulada',
    );
    expect(sales.getById).toHaveBeenCalledTimes(2);
  });
});
