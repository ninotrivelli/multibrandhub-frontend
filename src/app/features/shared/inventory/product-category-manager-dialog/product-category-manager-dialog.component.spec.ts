import { Signal, signal, WritableSignal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { makeCategory } from '../../../../../testing/builders';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ProductCategoriesService } from '../../../../core/product-categories/product-categories.service';
import { ProductCategoryResponse } from '../../../../core/product-categories/product-categories.types';
import { ProductCategoryManagerDialogComponent } from './product-category-manager-dialog.component';

describe('ProductCategoryManagerDialogComponent', () => {
  let fixture: ComponentFixture<ProductCategoryManagerDialogComponent>;
  let component: ProductCategoryManagerDialogComponent;
  let items: WritableSignal<ProductCategoryResponse[]>;
  let categories: {
    items: Signal<ProductCategoryResponse[]>;
    loading: Signal<boolean>;
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let notifications: { success: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    items = signal([makeCategory({ id: 'cat-tops', name: 'Tops' })]);
    const loading = signal(false);
    categories = {
      items: items.asReadonly(),
      loading: loading.asReadonly(),
      list: vi.fn(() => of(items())),
      create: vi.fn((body: { name: string }) => {
        const created = makeCategory({ id: 'cat-created', name: body.name });
        items.update((curr) => [...curr, created]);
        return of(created);
      }),
    };
    notifications = { success: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ProductCategoryManagerDialogComponent],
      providers: [
        { provide: ProductCategoriesService, useValue: categories },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    TestBed.overrideComponent(ProductCategoryManagerDialogComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(ProductCategoryManagerDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
  });

  it('loads categories when opened', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    expect(categories.list).toHaveBeenCalled();
  });

  it('blocks empty category names', () => {
    (component as any).name.set('   ');

    (component as any).submit();

    expect(categories.create).not.toHaveBeenCalled();
    expect((component as any).nameError()).toBe('Ingresá un nombre.');
  });

  it('blocks duplicate category names case-insensitively', () => {
    (component as any).name.set(' tops ');

    (component as any).submit();

    expect(categories.create).not.toHaveBeenCalled();
    expect((component as any).nameError()).toBe('Ya existe una categoría con ese nombre.');
  });

  it('creates a trimmed category and keeps the dialog ready for another one', () => {
    (component as any).name.set(' Abrigos ');

    (component as any).submit();

    expect(categories.create).toHaveBeenCalledWith({ name: 'Abrigos' });
    expect(notifications.success).toHaveBeenCalledWith('Se creó la categoría Abrigos.');
    expect((component as any).name()).toBe('');
    expect((component as any).nameTouched()).toBe(false);
  });

  it('shows backend errors without clearing the typed name', () => {
    categories.create.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: "Ya existe una categoría con el nombre 'Abrigos'." },
          }),
      ),
    );
    (component as any).name.set('Abrigos');

    (component as any).submit();

    expect((component as any).submitError()).toBe(
      "Ya existe una categoría con el nombre 'Abrigos'.",
    );
    expect((component as any).name()).toBe('Abrigos');
  });
});
