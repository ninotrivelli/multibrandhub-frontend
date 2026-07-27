import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { makeProduct, makeSale, paged } from '../../../../testing/builders';
import { AuthService } from '../../../core/auth/auth.service';
import { BrandsService } from '../../../core/brands/brands.service';
import { CashRegisterService } from '../../../core/cash-register/cash-register.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { SalesService } from '../../../core/sales/sales.service';
import { ProductCategoriesService } from '../../../core/product-categories/product-categories.service';
import { PosCartStore } from './pos-cart.store';
import { PosShellComponent } from './pos-shell.component';

describe('PosShellComponent', () => {
  let fixture: ComponentFixture<PosShellComponent>;
  let component: PosShellComponent;
  let cart: PosCartStore;
  let sales: { create: ReturnType<typeof vi.fn> };
  let notifications: { success: ReturnType<typeof vi.fn> };
  let cashRegister: any;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    sales = { create: vi.fn(() => of(makeSale())) };
    notifications = { success: vi.fn() };
    cashRegister = {
      current: signal(null),
      currentLoaded: signal(true),
      currentLoading: signal(false),
      currentError: signal(null),
      currentAgeDays: signal(null),
      currentAgeText: signal(null),
      hasStaleOpenRegister: signal(false),
      loadCurrent: vi.fn(() => of(null)),
    };

    TestBed.configureTestingModule({
      imports: [PosShellComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            role: signal('Seller').asReadonly(),
          },
        },
        {
          provide: SalesService,
          useValue: {
            create: sales.create,
          },
        },
        {
          provide: BrandsService,
          useValue: {
            hasItems: signal(false).asReadonly(),
            list: vi.fn(() => of(paged([]))),
          },
        },
        {
          provide: ProductCategoriesService,
          useValue: {
            list: vi.fn(() => of([])),
          },
        },
        { provide: CashRegisterService, useValue: cashRegister },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    TestBed.overrideComponent(PosShellComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(PosShellComponent);
    component = fixture.componentInstance;
    cart = fixture.debugElement.injector.get(PosCartStore);
    fixture.detectChanges();
  });

  it('opens the sale review instead of saving immediately', () => {
    cart.add(makeProduct({ id: 'p1', currentStock: 5 }));
    cart.setCardBrand('Visa');

    (component as any).openSaleReview();

    expect((component as any).saleReviewVisible()).toBe(true);
    expect(sales.create).not.toHaveBeenCalled();
  });

  it('confirms the sale from the review dialog and resets the POS state', () => {
    sales.create.mockReturnValueOnce(of(makeSale({ ticketId: 'TCK-1' })));
    cart.add(makeProduct({ id: 'p1', price: 1000, currentStock: 5 }));
    cart.setCardBrand('Visa');
    (component as any).saleReviewVisible.set(true);

    (component as any).confirmSale();

    expect(sales.create).toHaveBeenCalledWith({
      paymentMethod: 'DebitCard',
      cardBrand: 'Visa',
      details: [{ productId: 'p1', quantity: 1 }],
      observations: null,
    });
    expect((component as any).saleReviewVisible()).toBe(false);
    expect((component as any).submitting()).toBe(false);
    expect(cart.isEmpty()).toBe(true);
    expect(notifications.success).toHaveBeenCalledWith(
      'Venta registrada · Ticket TCK-1',
      'Venta ingresada',
    );
    expect(cashRegister.loadCurrent).toHaveBeenCalled();
  });

  it('keeps the review dialog open when saving fails', () => {
    sales.create.mockReturnValueOnce(throwError(() => new Error('save failed')));
    cart.add(makeProduct({ id: 'p1', currentStock: 5 }));
    cart.setCardBrand('Visa');
    (component as any).saleReviewVisible.set(true);

    (component as any).confirmSale();

    expect((component as any).saleReviewVisible()).toBe(true);
    expect((component as any).submitting()).toBe(false);
    expect(cart.isEmpty()).toBe(false);
  });

  it('does not block sale review when no register is open', () => {
    cashRegister.current.set(null);
    cashRegister.currentLoaded.set(true);
    cart.add(makeProduct({ id: 'p1', currentStock: 5 }));
    cart.setCardBrand('Visa');

    expect((component as any).noCashRegisterOpen()).toBe(true);

    (component as any).openSaleReview();

    expect((component as any).saleReviewVisible()).toBe(true);
  });

  it('warns before the sale review when the register is closed', () => {
    cashRegister.current.set(null);
    cashRegister.currentLoaded.set(true);
    cart.add(makeProduct({ id: 'p1', currentStock: 5 }));
    cart.setCardBrand('Visa');

    (component as any).onSubmitSale();

    expect((component as any).cashClosedPromptVisible()).toBe(true);
    expect((component as any).saleReviewVisible()).toBe(false);
  });

  it('opens the sale review directly when the register is open', () => {
    cashRegister.current.set({ status: 'Open' });
    cashRegister.currentLoaded.set(true);
    cart.add(makeProduct({ id: 'p1', currentStock: 5 }));
    cart.setCardBrand('Visa');

    (component as any).onSubmitSale();

    expect((component as any).cashClosedPromptVisible()).toBe(false);
    expect((component as any).saleReviewVisible()).toBe(true);
  });

  it('warns on every sale attempt when the open register belongs to a previous day', () => {
    cashRegister.current.set({ status: 'Open', openedAtUtc: '2026-07-09T11:00:00Z' });
    cashRegister.currentAgeDays.set(10);
    cashRegister.currentAgeText.set('hace 10 días');
    cashRegister.hasStaleOpenRegister.set(true);
    cart.add(makeProduct({ id: 'p1', currentStock: 5 }));
    cart.setCardBrand('Visa');

    (component as any).onSubmitSale();

    expect((component as any).staleCashPromptVisible()).toBe(true);
    expect((component as any).saleReviewVisible()).toBe(false);

    (component as any).proceedWithStaleCashRegister();

    expect((component as any).saleReviewVisible()).toBe(true);

    (component as any).saleReviewVisible.set(false);
    (component as any).onSubmitSale();

    expect((component as any).staleCashPromptVisible()).toBe(true);
    expect((component as any).saleReviewVisible()).toBe(false);
  });

  it('warns before manual and preselected returns, then preserves the requested return', () => {
    cashRegister.current.set({ status: 'Open', openedAtUtc: '2026-07-18T11:00:00Z' });
    cashRegister.currentAgeDays.set(1);
    cashRegister.currentAgeText.set('desde ayer');
    cashRegister.hasStaleOpenRegister.set(true);

    (component as any).openManualReturn();
    expect((component as any).staleCashPromptVisible()).toBe(true);
    expect((component as any).returnDialogVisible()).toBe(false);

    (component as any).proceedWithStaleCashRegister();
    expect((component as any).returnDialogVisible()).toBe(true);
    expect((component as any).returnPreselectedSaleId()).toBeNull();

    (component as any).returnDialogVisible.set(false);
    (component as any).openReturnForSale('sale-42');
    expect((component as any).staleCashPromptVisible()).toBe(true);

    (component as any).proceedWithStaleCashRegister();
    expect((component as any).returnDialogVisible()).toBe(true);
    expect((component as any).returnPreselectedSaleId()).toBe('sale-42');
  });

  it('continues to the sale review after confirming the closed-register prompt', () => {
    cashRegister.current.set(null);
    cashRegister.currentLoaded.set(true);
    cart.add(makeProduct({ id: 'p1', currentStock: 5 }));
    cart.setCardBrand('Visa');
    (component as any).cashClosedPromptVisible.set(true);

    (component as any).proceedWithoutCashRegister();

    expect((component as any).cashClosedPromptVisible()).toBe(false);
    expect((component as any).saleReviewVisible()).toBe(true);
  });
});
