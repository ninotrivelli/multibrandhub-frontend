import { TestBed } from '@angular/core/testing';

import { SessionStateRegistry } from '../session/session-state-registry.service';
import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;
  let sessionState: SessionStateRegistry;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
    sessionState = TestBed.inject(SessionStateRegistry);
  });

  it('tracks overlapping loading work with a non-negative counter', () => {
    expect(service.isLoading()).toBe(false);

    service.start();
    service.start();

    expect(service.isLoading()).toBe(true);

    service.stop();
    expect(service.isLoading()).toBe(true);

    service.stop();
    service.stop();
    expect(service.isLoading()).toBe(false);
  });

  it('clears loading state on session reset', () => {
    service.start();
    expect(service.isLoading()).toBe(true);

    sessionState.resetAll();

    expect(service.isLoading()).toBe(false);
  });
});
