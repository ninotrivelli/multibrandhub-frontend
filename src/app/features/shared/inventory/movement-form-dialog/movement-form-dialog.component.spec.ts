import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeAuthUser, makeMovement, makeProduct } from '../../../../../testing/builders';
import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { MovementType } from '../inventory.types';
import { ProductsService } from '../products.service';
import { StockMovementsService } from '../stock-movements.service';
import { MovementFormDialogComponent } from './movement-form-dialog.component';

describe('MovementFormDialogComponent', () => {
  let fixture: ComponentFixture<MovementFormDialogComponent>;
  let component: MovementFormDialogComponent;
  let movements: { create: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    movements = {
      create: vi.fn((body: any) =>
        of(makeMovement({ ...body, id: 'movement-created', quantity: body.quantity })),
      ),
    };

    TestBed.configureTestingModule({
      imports: [MovementFormDialogComponent],
      providers: [
        { provide: AuthService, useValue: { user: signal(makeAuthUser()).asReadonly() } },
        {
          provide: ProductsService,
          useValue: { searchOnce: vi.fn(() => of({ items: [], totalCount: 0, page: 1, pageSize: 8 })) },
        },
        { provide: StockMovementsService, useValue: movements },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(MovementFormDialogComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(MovementFormDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('initialProduct', null);
    fixture.detectChanges();
  });

  it('requires a selected product before submitting', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    (component as any).submit();

    expect((component as any).submitError()).toBe('Seleccioná un artículo antes de continuar.');
    expect(movements.create).not.toHaveBeenCalled();
  });

  it('rejects zero quantities and non-adjustment negative quantities in the form', () => {
    const product = makeProduct();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    (component as any).selectProduct(product);

    const form = (component as any).form;
    form.patchValue({ type: MovementType.StockIn, quantity: 0 });
    form.updateValueAndValidity();
    expect(form.errors).toEqual({ nonZero: true });

    form.patchValue({ type: MovementType.Loss, quantity: -1 });
    form.updateValueAndValidity();
    expect(form.errors).toEqual({ negativeNotAllowed: true });
    expect((component as any).canSubmit()).toBe(false);
  });

  it('allows negative adjustment quantities and sends the current user id', () => {
    const product = makeProduct();
    const saved = vi.fn();
    component.saved.subscribe(saved);

    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    (component as any).selectProduct(product);
    (component as any).form.patchValue({
      type: MovementType.Adjustment,
      quantity: -2,
      observations: '  Ajuste por conteo  ',
    });

    (component as any).submit();

    expect(movements.create).toHaveBeenCalledWith({
      productId: product.id,
      quantity: -2,
      type: MovementType.Adjustment,
      observations: 'Ajuste por conteo',
      userId: 'user-admin',
    });
    expect(saved).toHaveBeenCalledWith(
      expect.objectContaining({ productId: product.id, quantity: -2 }),
    );
  });
});
