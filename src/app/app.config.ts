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
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { AuthService } from './core/auth/auth.service';
import { tenantInterceptor } from './core/tenancy/tenant.interceptor';

const MultiBrandHubPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([tenantInterceptor, authInterceptor, errorInterceptor])),
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    MessageService,
    providePrimeNG({
      theme: {
        preset: MultiBrandHubPreset,
        options: {
          // Decouple dark mode from the OS preference. Dark styles only apply
          // when `.app-dark` is present on <html>; we never add it, so the app
          // stays light. A future explicit theme toggle can flip this class.
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
