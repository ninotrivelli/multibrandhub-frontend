import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideAngularModule, Check } from 'lucide-angular';

import { ThemeService } from '../../../core/theme/theme.service';
import { ThemeId } from '../../../core/theme/theme.types';

@Component({
  selector: 'app-theme-selector',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './theme-selector.component.html',
})
export class ThemeSelectorComponent {
  private readonly themeService = inject(ThemeService);

  protected readonly icons = { Check };
  protected readonly themes = this.themeService.themes;
  protected readonly current = this.themeService.current;

  protected select(id: ThemeId): void {
    this.themeService.setTheme(id);
  }
}
