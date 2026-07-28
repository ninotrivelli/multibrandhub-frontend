import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { faHandHoldingDollar } from '@fortawesome/free-solid-svg-icons';
import { Home } from 'lucide-angular';

import { primeNgTestProviders } from '../../../../testing/primeng-test-providers';
import {
  fa,
  lucide,
  NavigationDrawerComponent,
  NavSection,
} from './navigation-drawer';

describe('NavigationDrawerComponent', () => {
  let fixture: ComponentFixture<NavigationDrawerComponent>;
  let component: NavigationDrawerComponent;
  let matches: boolean;
  let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
  let addEventListener: ReturnType<typeof vi.fn>;
  let removeEventListener: ReturnType<typeof vi.fn>;

  const sections: NavSection[] = [
    {
      title: 'Principal',
      items: [
        { label: 'Inicio', path: '/inicio', icon: lucide(Home) },
        { label: 'Liquidaciones', path: '/liquidaciones', icon: fa(faHandHoldingDollar) },
      ],
    },
  ];

  beforeEach(async () => {
    matches = false;
    addEventListener = vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      changeListener = listener;
    });
    removeEventListener = vi.fn();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        get matches() {
          return matches;
        },
        media: '(max-width: 768px)',
        onchange: null,
        addEventListener,
        removeEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NavigationDrawerComponent],
      providers: [provideRouter([]), ...primeNgTestProviders()],
    });
    TestBed.overrideComponent(NavigationDrawerComponent, {
      set: { styles: [] },
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(NavigationDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('sections', sections);
    fixture.componentRef.setInput('footerItems', [
      { label: 'Configuración', path: '/config', icon: lucide(Home) },
    ]);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders Lucide and FontAwesome links with expanded desktop labels', () => {
    expect((component as any).isMobile()).toBe(false);
    expect((component as any).drawerStyleClass()).toBe('app-nav-drawer');
    expect(fixture.nativeElement.textContent).toContain('MultiBrandHub');
    expect(fixture.nativeElement.textContent).toContain('Principal');
    expect(fixture.nativeElement.textContent).toContain('Inicio');
    expect(fixture.nativeElement.textContent).toContain('Liquidaciones');
    expect(fixture.nativeElement.textContent).toContain('Configuración');
    expect(fixture.nativeElement.querySelector('fa-icon')).not.toBeNull();
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('collapses desktop navigation and emits the collapse action', () => {
    const toggle = vi.fn();
    component.toggleCollapse.subscribe(toggle);
    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();

    expect((component as any).drawerStyleClass()).toContain('app-nav-drawer-collapsed');
    expect(fixture.nativeElement.textContent).not.toContain('Principal');
    expect(fixture.nativeElement.querySelector('a')?.getAttribute('title')).toBe('Inicio');

    (component as any).onToggleClick();
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('opens mobile styling, closes from toggle and closes after link navigation', () => {
    const close = vi.fn();
    component.closeMobile.subscribe(close);
    changeListener?.({ matches: true } as MediaQueryListEvent);
    fixture.componentRef.setInput('mobileOpen', true);
    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();

    expect((component as any).isMobile()).toBe(true);
    expect((component as any).drawerStyleClass()).toContain('app-nav-drawer-mobile-open');
    expect(fixture.nativeElement.textContent).toContain('Principal');

    (component as any).onToggleClick();
    (component as any).onLinkClick();
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('does not close mobile navigation for links when the drawer is already closed', () => {
    const close = vi.fn();
    component.closeMobile.subscribe(close);
    changeListener?.({ matches: true } as MediaQueryListEvent);
    fixture.componentRef.setInput('mobileOpen', false);

    (component as any).onLinkClick();

    expect(close).not.toHaveBeenCalled();
  });

  it('removes the responsive media listener on destroy', () => {
    fixture.destroy();

    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
