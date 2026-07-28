import { EnvironmentProviders, Provider } from '@angular/core';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { DEFAULT_PRESET } from '../app/core/theme/theme.presets';

export function primeNgTestProviders(): Array<Provider | EnvironmentProviders> {
  return [
    MessageService,
    providePrimeNG({
      theme: {
        preset: DEFAULT_PRESET,
      },
    }),
  ];
}
