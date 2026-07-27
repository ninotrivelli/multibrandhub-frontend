import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import {
  KeyRound,
  LucideAngularModule,
  Power,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from 'lucide-angular';

import { MfaService } from '../../../../core/auth/mfa.service';
import { MfaReauthDialogComponent, MfaReauthMode } from './mfa-reauth-dialog.component';
import { MfaSetupDialogComponent } from './mfa-setup-dialog.component';

@Component({
  selector: 'app-admin-seguridad',
  imports: [
    DatePipe,
    ButtonModule,
    MessageModule,
    SkeletonModule,
    TagModule,
    LucideAngularModule,
    MfaSetupDialogComponent,
    MfaReauthDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seguridad.component.html',
})
export class AdminSeguridadComponent implements OnInit {
  private readonly mfa = inject(MfaService);

  readonly active = input(true);

  protected readonly icons = { KeyRound, Power, RefreshCw, ShieldCheck, ShieldOff };
  protected readonly status = this.mfa.status;
  protected readonly loading = this.mfa.loadingStatus;
  protected readonly statusError = signal(false);
  protected readonly setupVisible = signal(false);
  protected readonly reauthVisible = signal(false);
  protected readonly reauthMode = signal<MfaReauthMode>('regenerate');

  constructor() {
    effect(() => {
      if (!this.active()) {
        untracked(() => {
          this.setupVisible.set(false);
          this.reauthVisible.set(false);
        });
      }
    });
  }

  ngOnInit(): void {
    this.loadStatus();
  }

  protected loadStatus(force = false): void {
    this.statusError.set(false);
    this.mfa.loadStatus(force).subscribe({
      error: () => this.statusError.set(true),
    });
  }

  protected openSetup(): void {
    this.setupVisible.set(true);
  }

  protected openReauthentication(mode: MfaReauthMode): void {
    this.reauthMode.set(mode);
    this.reauthVisible.set(true);
  }
}
