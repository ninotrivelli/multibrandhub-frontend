import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

const STORAGE_KEY = 'mbh-theme';

function createService(): ThemeService {
  TestBed.resetTestingModule();
  return TestBed.inject(ThemeService);
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('app-dark');
  });

  it('defaults to "default" when nothing is stored', () => {
    const service = createService();
    expect(service.current()).toBe('default');
  });

  it('falls back to "default" for an invalid stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-theme');
    const service = createService();
    expect(service.current()).toBe('default');
  });

  it('reads a valid stored theme on construction', () => {
    localStorage.setItem(STORAGE_KEY, 'fresh');
    const service = createService();
    expect(service.current()).toBe('fresh');
  });

  it('persists the selected theme and updates the signal', () => {
    const service = createService();
    service.setTheme('executive');
    expect(service.current()).toBe('executive');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('executive');
  });

  it('adds the app-dark class for the dark theme', () => {
    const service = createService();
    service.setTheme('dark');
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
  });

  it('removes the app-dark class when switching to a light theme', () => {
    const service = createService();
    service.setTheme('dark');
    service.setTheme('fresh');
    expect(document.documentElement.classList.contains('app-dark')).toBe(false);
  });

  it('ignores unknown theme ids', () => {
    const service = createService();
    service.setTheme('bogus' as never);
    expect(service.current()).toBe('default');
  });

  it('init applies the stored theme', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    const service = createService();
    service.init();
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
  });
});
