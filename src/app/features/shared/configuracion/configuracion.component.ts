import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { LucideAngularModule, KeyRound, Settings } from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.types';
import {
  ResetPasswordDialogComponent,
  ResetPasswordTarget
} from '../../../shared/components/reset-password-dialog/reset-password-dialog.component';

const ROLE_LABELS: Record<UserRole, string> = {
  SuperAdmin: 'Super Admin',
  Admin: 'Administrador',
  BrandManager: 'Marca',
  Seller: 'Vendedor/a'
};

const ROLE_SEVERITY: Record<UserRole, 'info' | 'success' | 'warn' | 'secondary'> = {
  SuperAdmin: 'warn',
  Admin: 'info',
  BrandManager: 'success',
  Seller: 'secondary'
};

@Component({
  selector: 'app-configuracion',
  imports: [
    AvatarModule,
    ButtonModule,
    TagModule,
    LucideAngularModule,
    ResetPasswordDialogComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6 max-w-2xl">
      <header class="flex items-center gap-3">
        <i-lucide [img]="icons.Settings" class="size-6 text-primary" />
        <div>
          <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-0">Configuración</h2>
          <p class="text-sm text-surface-500 dark:text-surface-400">
            Tu perfil y preferencias de cuenta.
          </p>
        </div>
      </header>

      @if (user(); as u) {
        <section class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-6">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <p-avatar
              [label]="initials()"
              shape="circle"
              size="large"
              styleClass="bg-primary text-primary-contrast"
            />
            <div class="flex flex-col gap-1 flex-1">
              <div class="text-lg font-semibold text-surface-900 dark:text-surface-0">
                {{ u.fullName }}
              </div>
              <div class="text-sm text-surface-600 dark:text-surface-300">
                {{ u.email }}
              </div>
              <div class="flex flex-wrap items-center gap-2 mt-1">
                <p-tag [value]="roleLabel(u.role)" [severity]="roleSeverity(u.role)" />
                @if (u.brandId) {
                  <p-tag value="Marca asociada" severity="success" />
                }
              </div>
            </div>
          </div>
        </section>

        <section class="bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-6 flex flex-col gap-4">
          <div>
            <h3 class="text-base font-semibold text-surface-900 dark:text-surface-0">Seguridad</h3>
            <p class="text-sm text-surface-500 dark:text-surface-400">
              Cambiá tu contraseña cuando lo necesites.
            </p>
          </div>
          <div>
            <button
              pButton
              type="button"
              severity="secondary"
              label="Cambiar contraseña"
              (click)="openResetPassword()"
            >
              <i-lucide [img]="icons.KeyRound" class="size-4 mr-2" />
            </button>
          </div>
        </section>
      } @else {
        <p class="text-sm text-surface-500 dark:text-surface-400">
          No hay sesión activa.
        </p>
      }
    </div>

    <app-reset-password-dialog
      [visible]="resetDialogVisible()"
      [target]="resetTarget()"
      (visibleChange)="onResetVisibleChange($event)"
    />
  `
})
export class ConfiguracionComponent {
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.user;
  protected readonly icons = { KeyRound, Settings };

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
