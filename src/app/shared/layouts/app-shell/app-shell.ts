import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { LogOut, LucideAngularModule, Menu } from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';
import { NavigationDrawerComponent } from '../../components/navigation-drawer/navigation-drawer';
import { NAV_CONFIG } from './nav-config';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    ButtonModule,
    AvatarModule,
    LucideAngularModule,
    NavigationDrawerComponent
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShell {
  private readonly auth = inject(AuthService);

  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);

  protected readonly user = this.auth.user;
  protected readonly role = this.auth.role;

  protected readonly config = computed(() => {
    const r = this.role();
    return r ? NAV_CONFIG[r] : null;
  });

  protected readonly navItems = computed(() => this.config()?.navItems ?? []);

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

  protected readonly icons = { LogOut, Menu };

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
