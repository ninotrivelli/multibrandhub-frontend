import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messages = inject(MessageService);

  success(detail: string, summary = 'Listo'): void {
    this.messages.add({ severity: 'success', summary, detail, life: 3500 });
  }

  info(detail: string, summary = 'Info'): void {
    this.messages.add({ severity: 'info', summary, detail, life: 3500 });
  }

  warn(detail: string, summary = 'Atención'): void {
    this.messages.add({ severity: 'warn', summary, detail, life: 4500 });
  }

  error(detail: string, summary = 'Error'): void {
    this.messages.add({ severity: 'error', summary, detail, life: 5500 });
  }
}
