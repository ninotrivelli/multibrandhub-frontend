import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeBrand } from '../../../../../../testing/builders';
import { primeNgTestProviders } from '../../../../../../testing/primeng-test-providers';
import { BrandsService } from '../../../../../core/brands/brands.service';
import { NotificationService } from '../../../../../core/notifications/notification.service';
import { BrandFormDialogComponent } from './brand-form-dialog.component';

describe('BrandFormDialogComponent', () => {
  let fixture: ComponentFixture<BrandFormDialogComponent>;
  let component: BrandFormDialogComponent;
  let brands: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: primeNgTestProviders() });
    brands = {
      create: vi.fn((body: any) => of(makeBrand({ ...body, id: 'brand-created' }))),
      update: vi.fn((id: string, body: any) => of(makeBrand({ ...body, id }))),
    };

    TestBed.configureTestingModule({
      imports: [BrandFormDialogComponent],
      providers: [
        { provide: BrandsService, useValue: brands },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(BrandFormDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('editing', null);
    fixture.detectChanges();
  });

  it('normalizes brand codes and contract values before creating', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    (component as any).normalizeCodeInput('lum-01');
    (component as any).form.patchValue({
      name: ' Lumina ',
      logoUrl: ' ',
      contactEmail: 'lumina@test.com',
      contractType: 'FixedRent',
      commissionPercentage: 25,
      fixedRentCost: 4000,
    });

    (component as any).submit();

    expect(brands.create).toHaveBeenCalledWith({
      name: 'Lumina',
      code: 'LUM-01',
      logoUrl: null,
      contactEmail: 'lumina@test.com',
      contractType: 'FixedRent',
      commissionPercentage: 0,
      fixedRentCost: 4000,
    });
  });

  it('does not send immutable code when editing', () => {
    const editing = makeBrand({ id: 'brand-edit', code: 'ZEND' });
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('editing', editing);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    (component as any).form.patchValue({
      name: 'Zendra Editada',
      contractType: 'CommissionOnly',
      commissionPercentage: 15,
      fixedRentCost: 9999,
    });
    (component as any).submit();

    expect(brands.update).toHaveBeenCalledWith(
      'brand-edit',
      expect.objectContaining({
        name: 'Zendra Editada',
        commissionPercentage: 15,
        fixedRentCost: 0,
      }),
    );
    expect(brands.update.mock.calls[0][1].code).toBeUndefined();
  });
});
