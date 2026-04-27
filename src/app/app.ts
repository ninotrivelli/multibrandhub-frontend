import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';

import { LoadingService } from './core/loading/loading.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, ProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly loading = inject(LoadingService);
}
