import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { LucideAngularModule, Mail, MapPin, Pencil, Phone, Plus, Store } from 'lucide-angular';

import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { StoreProfileService } from './store-profile.service';
import { UpdateStoreProfileRequest } from './store-profile.types';

type ProfileControlName =
  | 'storeName'
  | 'address'
  | 'primaryPhone'
  | 'secondaryPhone'
  | 'contactEmail';

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

@Component({
  selector: 'app-ajustes-generales',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    SkeletonModule,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ajustes-generales.component.html',
})
export class AdminAjustesGeneralesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(StoreProfileService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  protected readonly icons = { Mail, MapPin, Pencil, Phone, Plus, Store };

  protected readonly profile = this.service.profile;
  protected readonly hasData = this.service.hasData;
  protected readonly saving = this.service.saving;

  protected readonly editing = signal(false);

  protected readonly showSkeleton = computed(
    () => this.service.loading() && this.service.profile() === null,
  );

  protected readonly canEdit = computed(() => {
    const role = this.auth.role();
    return role === 'Admin' || role === 'SuperAdmin';
  });

  protected readonly form = this.fb.group({
    storeName: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
    address: this.fb.nonNullable.control('', [Validators.maxLength(300)]),
    primaryPhone: this.fb.nonNullable.control('', [Validators.maxLength(50)]),
    secondaryPhone: this.fb.nonNullable.control('', [Validators.maxLength(50)]),
    contactEmail: this.fb.nonNullable.control('', [Validators.maxLength(150), Validators.email]),
  });

  protected isInvalid(controlName: ProfileControlName): boolean {
    const c = this.form.controls[controlName];
    return c.invalid && (c.touched || c.dirty);
  }

  protected startEdit(): void {
    if (!this.canEdit()) return;
    const current = this.profile();
    this.form.reset({
      storeName: current?.storeName ?? '',
      address: current?.address ?? '',
      primaryPhone: current?.primaryPhone ?? '',
      secondaryPhone: current?.secondaryPhone ?? '',
      contactEmail: current?.contactEmail ?? '',
    });
    this.editing.set(true);
  }

  protected cancel(): void {
    if (this.saving()) return;
    this.editing.set(false);
  }

  protected submit(): void {
    if (this.saving()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const req: UpdateStoreProfileRequest = {
      storeName: raw.storeName.trim(),
      address: trimOrNull(raw.address),
      primaryPhone: trimOrNull(raw.primaryPhone),
      secondaryPhone: trimOrNull(raw.secondaryPhone),
      contactEmail: trimOrNull(raw.contactEmail),
    };

    this.service.update(req).subscribe({
      next: () => {
        this.notifications.success('Se guardaron los ajustes del local.');
        this.editing.set(false);
      },
      error: (_err: HttpErrorResponse) => {
        // error.interceptor already shows a toast
      },
    });
  }
}
