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
import { HttpErrorResponse } from '@angular/common/http';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

import { NotificationService } from '../../../../core/notifications/notification.service';
import { ProductCategoriesService } from '../../../../core/product-categories/product-categories.service';

@Component({
  selector: 'app-product-category-manager-dialog',
  imports: [ButtonModule, DialogModule, InputTextModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-category-manager-dialog.component.html',
})
export class ProductCategoryManagerDialogComponent {
  private readonly categories = inject(ProductCategoriesService);
  private readonly notifications = inject(NotificationService);

  readonly visible = input.required<boolean>();

  readonly visibleChange = output<boolean>();

  protected readonly categoryItems = this.categories.items;
  protected readonly loading = this.categories.loading;
  protected readonly name = signal('');
  protected readonly nameTouched = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly busy = computed(() => this.submitting());
  protected readonly trimmedName = computed(() => this.name().trim());
  protected readonly duplicateName = computed(() => {
    const normalized = normalizeCategoryName(this.trimmedName());
    if (!normalized) return false;
    return this.categoryItems().some(
      (category) => normalizeCategoryName(category.name) === normalized,
    );
  });
  protected readonly nameError = computed(() => {
    if (!this.nameTouched()) return null;
    if (this.trimmedName().length === 0) return 'Ingresá un nombre.';
    if (this.duplicateName()) return 'Ya existe una categoría con ese nombre.';
    return null;
  });

  constructor() {
    effect(() => {
      const open = this.visible();
      if (open) {
        untracked(() => {
          this.resetForm();
          this.categories.list().subscribe({ error: () => {} });
        });
      }
    });
  }

  protected onVisibleChange(value: boolean): void {
    if (!value && this.busy()) return;
    this.visibleChange.emit(value);
    if (!value) this.resetForm();
  }

  protected onNameInput(value: string): void {
    this.name.set(value);
    this.submitError.set(null);
  }

  protected submit(): void {
    if (this.busy()) return;

    this.nameTouched.set(true);
    this.submitError.set(null);
    if (this.nameError()) return;

    const name = this.trimmedName();
    this.submitting.set(true);
    this.categories.create({ name }).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.notifications.success(`Se creó la categoría ${created.name}.`);
        this.resetForm();
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.setSubmitError(err);
      },
    });
  }

  private resetForm(): void {
    this.name.set('');
    this.nameTouched.set(false);
    this.submitError.set(null);
  }

  private setSubmitError(err: HttpErrorResponse): void {
    const body = err.error as { message?: string; errors?: { message: string }[] } | undefined;
    if (body?.errors?.length) {
      this.submitError.set(body.errors.map((e) => e.message).join(' • '));
    } else if (body?.message) {
      this.submitError.set(body.message);
    } else {
      this.submitError.set('No se pudo crear la categoría. Probá de nuevo.');
    }
  }
}

function normalizeCategoryName(value: string): string {
  return value.trim().toLocaleLowerCase('es-UY');
}
