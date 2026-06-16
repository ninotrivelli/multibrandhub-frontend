import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import {
  ChevronsLeft,
  ChevronsRight,
  LucideAngularModule,
  LucideIconData,
  X
} from 'lucide-angular';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export type IconRef =
  | { readonly kind: 'lucide'; readonly data: LucideIconData }
  | { readonly kind: 'fa'; readonly def: IconDefinition };

export const lucide = (data: LucideIconData): IconRef => ({ kind: 'lucide', data });
export const fa = (def: IconDefinition): IconRef => ({ kind: 'fa', def });

export interface NavItem {
  label: string;
  path: string;
  icon: IconRef;
}

export interface NavSection {
  // Omit the title for a group with no header (e.g. the top-level "Inicio").
  readonly title?: string;
  readonly items: ReadonlyArray<NavItem>;
}

@Component({
  selector: 'app-navigation-drawer',
  imports: [
    DrawerModule,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    LucideAngularModule,
    FaIconComponent
  ],
  templateUrl: './navigation-drawer.html',
  styleUrl: './navigation-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavigationDrawerComponent implements OnInit, OnDestroy {
  private readonly zone = inject(NgZone);

  readonly collapsed = input(false);
  readonly mobileOpen = input(false);
  readonly sections = input.required<ReadonlyArray<NavSection>>();
  readonly footerItems = input<ReadonlyArray<NavItem>>([]);

  readonly toggleCollapse = output<void>();
  readonly closeMobile = output<void>();

  protected readonly isMobile = signal(false);

  protected readonly drawerStyleClass = computed((): string => {
    const classes = ['app-nav-drawer'];
    if (!this.isMobile() && this.collapsed()) {
      classes.push('app-nav-drawer-collapsed');
    }
    if (this.isMobile() && this.mobileOpen()) {
      classes.push('app-nav-drawer-mobile-open');
    }
    return classes.join(' ');
  });

  protected readonly toggleIcon = computed<LucideIconData>(() => {
    if (this.isMobile()) return X;
    return this.collapsed() ? ChevronsRight : ChevronsLeft;
  });

  private mediaQueryList: MediaQueryList | null = null;

  private readonly mediaQueryListener = (event: MediaQueryListEvent): void => {
    this.zone.run(() => {
      this.isMobile.set(event.matches);
    });
  };

  protected onToggleClick(): void {
    if (this.isMobile()) {
      this.closeMobile.emit();
    } else {
      this.toggleCollapse.emit();
    }
  }

  protected onLinkClick(): void {
    if (this.isMobile() && this.mobileOpen()) {
      this.closeMobile.emit();
    }
  }

  ngOnInit(): void {
    if (typeof window === 'undefined') return;

    this.mediaQueryList = window.matchMedia('(max-width: 768px)');
    this.isMobile.set(this.mediaQueryList.matches);
    this.mediaQueryList.addEventListener('change', this.mediaQueryListener);
  }

  ngOnDestroy(): void {
    this.mediaQueryList?.removeEventListener('change', this.mediaQueryListener);
  }
}
