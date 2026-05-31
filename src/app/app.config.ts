import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { AuthService } from './core/auth/auth.service';
import { tenantInterceptor } from './core/tenancy/tenant.interceptor';
import { ThemeService } from './core/theme/theme.service';
import { DEFAULT_PRESET } from './core/theme/theme.presets';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([tenantInterceptor, authInterceptor, errorInterceptor])),
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    provideAppInitializer(() => inject(ThemeService).init()),
    MessageService,
    providePrimeNG({
      theme: {
        preset: DEFAULT_PRESET,
        options: {
          // Decouple dark mode from the OS preference. Dark styles only apply
          // when `.app-dark` is present on <html>. ThemeService adds/removes
          // this class based on the user's saved theme (see core/theme).
          darkModeSelector: '.app-dark',
        },
      },
      translation: {
        passwordPrompt: 'Ingresá una contraseña',
        weak: 'Débil',
        medium: 'Media',
        strong: 'Fuerte',
      },
    }),
  ],
};
