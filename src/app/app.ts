import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';

import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';

import { LoadingService } from './core/loading/loading.service';
import { StoreProfileService } from './core/store-profile/store-profile.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, ProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly loading = inject(LoadingService);

  private readonly title = inject(Title);
  private readonly storeProfile = inject(StoreProfileService);

  constructor() {
    effect(() => {
      const storeName = this.storeProfile.storeName().trim();
      this.title.setTitle(storeName ? `${storeName} - MultiBrandHub` : 'MultiBrandHub');
    });
  }
}
