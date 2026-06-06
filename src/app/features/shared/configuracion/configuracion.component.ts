import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { LucideAngularModule, KeyRound, Palette, Settings } from 'lucide-angular';

import { ThemeSelectorComponent } from '../../../shared/components/theme-selector/theme-selector.component';
import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.types';
import { BrandsService } from '../../../core/brands/brands.service';
import {
  ResetPasswordDialogComponent,
  ResetPasswordTarget,
} from '../../../shared/components/reset-password-dialog/reset-password-dialog.component';

const ROLE_LABELS: Record<UserRole, string> = {
  SuperAdmin: 'Super Admin',
  Admin: 'Administrador',
  BrandManager: 'Marca',
  Seller: 'Vendedor/a',
};

const ROLE_SEVERITY: Record<UserRole, 'info' | 'success' | 'warn' | 'secondary'> = {
  SuperAdmin: 'warn',
  Admin: 'info',
  BrandManager: 'success',
  Seller: 'secondary',
};

@Component({
  selector: 'app-configuracion',
  imports: [
    AvatarModule,
    ButtonModule,
    TagModule,
    LucideAngularModule,
    ResetPasswordDialogComponent,
    ThemeSelectorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './configuracion.component.html',
})
export class ConfiguracionComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly brands = inject(BrandsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly user = this.auth.user;
  protected readonly icons = { KeyRound, Palette, Settings };

  protected readonly resetDialogVisible = signal(false);
  protected readonly resetTarget = signal<ResetPasswordTarget | null>(null);

  protected readonly initials = computed(() => {
    const name = this.user()?.fullName ?? '';
    return (
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]!.toUpperCase())
        .join('') || '?'
    );
  });

  protected readonly associatedBrandName = computed(() => {
    const brandId = this.user()?.brandId;
    if (!brandId) return null;
    return this.brands.items().find((brand) => brand.id === brandId)?.name ?? null;
  });

  ngOnInit(): void {
    if (!this.user()?.brandId || this.brands.hasItems() || this.brands.loading()) return;

    this.brands
      .list({ page: 1, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => {} });
  }

  protected roleLabel(role: UserRole): string {
    return ROLE_LABELS[role];
  }

  protected roleSeverity(role: UserRole): 'info' | 'success' | 'warn' | 'secondary' {
    return ROLE_SEVERITY[role];
  }

  protected openResetPassword(): void {
    const u = this.user();
    if (!u) return;
    this.resetTarget.set({ id: u.userId, fullName: u.fullName, isSelf: true });
    this.resetDialogVisible.set(true);
  }

  protected onResetVisibleChange(value: boolean): void {
    this.resetDialogVisible.set(value);
  }
}
