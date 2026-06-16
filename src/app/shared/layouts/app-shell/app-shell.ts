import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { LogOut, LucideAngularModule, Menu, Store } from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';
import { CashRegisterService } from '../../../core/cash-register/cash-register.service';
import { StoreProfileService } from '../../../core/store-profile/store-profile.service';
import { NavigationDrawerComponent } from '../../components/navigation-drawer/navigation-drawer';
import { NAV_CONFIG } from './nav-config';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    ButtonModule,
    AvatarModule,
    TagModule,
    LucideAngularModule,
    NavigationDrawerComponent
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShell {
  private readonly auth = inject(AuthService);
  private readonly storeProfile = inject(StoreProfileService);
  private readonly cashRegister = inject(CashRegisterService);

  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);

  protected readonly user = this.auth.user;
  protected readonly role = this.auth.role;
  protected readonly storeName = this.storeProfile.storeName;

  protected readonly config = computed(() => {
    const r = this.role();
    return r ? NAV_CONFIG[r] : null;
  });

  protected readonly sections = computed(() => this.config()?.sections ?? []);
  protected readonly footerItems = computed(() => this.config()?.footerItems ?? []);

  protected readonly showCashStatus = computed(() => !!this.config()?.showCashRegisterStatus);
  protected readonly cashLoaded = this.cashRegister.currentLoaded;
  protected readonly cashOpen = this.cashRegister.hasOpenRegister;

  protected readonly initials = computed((): string => {
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

  protected readonly icons = { LogOut, Menu, Store };

  constructor() {
    this.storeProfile
      .load()
      .pipe(takeUntilDestroyed())
      .subscribe({
        error: () => {
          // error.interceptor already shows a toast
        },
      });

    // Keep the top-bar cash register badge accurate from any screen.
    // Admin/SuperAdmin and Seller can access the store-wide register endpoint.
    if (this.showCashStatus()) {
      this.cashRegister
        .loadCurrent()
        .pipe(takeUntilDestroyed())
        .subscribe({
          error: () => {
            // error.interceptor already shows a toast
          },
        });
    }
  }

  protected toggleCollapse(): void {
    this.collapsed.update((v) => !v);
  }

  protected openMobile(): void {
    this.mobileOpen.set(true);
  }

  protected closeMobile(): void {
    this.mobileOpen.set(false);
  }

  protected logout(): void {
    this.auth.logout();
  }
}
