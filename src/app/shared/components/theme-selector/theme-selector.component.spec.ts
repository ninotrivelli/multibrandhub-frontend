import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemeService } from '../../../core/theme/theme.service';
import { ThemeSelectorComponent } from './theme-selector.component';

describe('ThemeSelectorComponent', () => {
  let fixture: ComponentFixture<ThemeSelectorComponent>;
  let service: ThemeService;

  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.classList.remove('app-dark');

    await TestBed.configureTestingModule({
      imports: [ThemeSelectorComponent],
    }).compileComponents();

    service = TestBed.inject(ThemeService);
    fixture = TestBed.createComponent(ThemeSelectorComponent);
    fixture.detectChanges();
  });

  it('renders one option per theme', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button[role="radio"]');
    expect(buttons.length).toBe(service.themes.length);
  });

  it('selecting an option updates the service', () => {
    const setTheme = vi.spyOn(service, 'setTheme');
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button[role="radio"]'),
    );
    const executiveIndex = service.themes.findIndex((t) => t.id === 'executive');

    buttons[executiveIndex].click();
    fixture.detectChanges();

    expect(setTheme).toHaveBeenCalledWith('executive');
    expect(service.current()).toBe('executive');
  });

  it('marks the current theme as checked', () => {
    service.setTheme('fresh');
    fixture.detectChanges();
    const checked = fixture.nativeElement.querySelector('button[aria-checked="true"]');
    expect(checked?.textContent).toContain('Fresco');
  });
});
