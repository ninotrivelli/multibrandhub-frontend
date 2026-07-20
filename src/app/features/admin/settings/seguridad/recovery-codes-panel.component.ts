import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { Copy, Download, LucideAngularModule } from 'lucide-angular';

import { NotificationService } from '../../../../core/notifications/notification.service';

@Component({
  selector: 'app-recovery-codes-panel',
  imports: [ButtonModule, MessageModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recovery-codes-panel.component.html',
})
export class RecoveryCodesPanelComponent {
  private readonly notifications = inject(NotificationService);

  readonly codes = input.required<readonly string[]>();
  readonly sessionInvalidated = input(false);
  readonly completed = output<void>();

  protected readonly icons = { Copy, Download };
  protected readonly acknowledged = signal(false);

  constructor() {
    effect(() => {
      this.codes();
      untracked(() => this.acknowledged.set(false));
    });
  }

  protected async copyAll(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.codes().join('\n'));
      this.notifications.success('Códigos copiados al portapapeles.');
    } catch {
      this.notifications.error('No pudimos copiar los códigos. Usá la opción de descarga.');
    }
  }

  protected download(): void {
    const content = [
      'MultiBrandHub — Códigos de recuperación MFA',
      '',
      'Cada código funciona una sola vez. Guardalos en un lugar seguro.',
      '',
      ...this.codes(),
      '',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'multibrandhub-codigos-recuperacion.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected finish(): void {
    if (!this.acknowledged()) return;
    this.completed.emit();
  }
}
