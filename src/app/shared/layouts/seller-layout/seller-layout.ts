import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';

import { AuthService } from '../../../core/auth/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { path: '/seller/pos', label: 'Ingresar Venta', icon: 'pi pi-shopping-cart' },
  { path: '/seller/inventory', label: 'Inventario', icon: 'pi pi-box' },
  { path: '/seller/cash-register', label: 'Cierre de Caja', icon: 'pi pi-dollar' },
  { path: '/seller/tasks', label: 'Tareas Diarias', icon: 'pi pi-check-square' }
];

@Component({
  selector: 'app-seller-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ButtonModule, AvatarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex bg-surface-50 dark:bg-surface-900">
      <aside
        class="w-64 shrink-0 bg-surface-0 dark:bg-surface-800 border-r border-surface-200 dark:border-surface-700 flex flex-col"
      >
        <div class="h-16 flex items-center px-6 border-b border-surface-200 dark:border-surface-700">
          <span class="text-lg font-bold text-primary">MultiBrandHub</span>
        </div>
        <nav class="flex-1 overflow-y-auto p-3 space-y-1">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-primary-50 text-primary dark:bg-primary-900/30"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            >
              <i [class]="item.icon" class="text-base"></i>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>
      </aside>

      <div class="flex-1 flex flex-col min-w-0">
        <header
          class="h-16 shrink-0 bg-surface-0 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex items-center justify-end gap-3 px-6"
        >
          <p-avatar [label]="initials()" shape="circle" styleClass="bg-primary text-primary-contrast" />
          <div class="text-right">
            <div class="text-sm font-medium text-surface-900 dark:text-surface-0">
              {{ user()?.fullName ?? 'Vendedora' }}
            </div>
            <div class="text-xs font-semibold text-primary uppercase tracking-wide">Vendedora</div>
          </div>
          <button
            pButton
            icon="pi pi-sign-out"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            ariaLabel="Cerrar sesión"
            (click)="logout()"
          ></button>
        </header>

        <main class="flex-1 overflow-auto">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class SellerLayout {
  private readonly auth = inject(AuthService);

  protected readonly nav = NAV_ITEMS;
  protected readonly user = this.auth.user;

  protected initials(): string {
    const name = this.auth.user()?.fullName ?? '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('');
  }

  protected logout(): void {
    this.auth.logout();
  }
}
