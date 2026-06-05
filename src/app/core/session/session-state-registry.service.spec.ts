import { TestBed } from '@angular/core/testing';

import { SessionStateRegistry } from './session-state-registry.service';

describe('SessionStateRegistry', () => {
  let service: SessionStateRegistry;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionStateRegistry);
  });

  it('runs registered resetters and advances the session generation', () => {
    const resetter = vi.fn();
    const generation = service.captureGeneration();

    service.registerResetter(resetter);
    service.resetAll();

    expect(resetter).toHaveBeenCalledTimes(1);
    expect(service.isCurrentGeneration(generation)).toBe(false);
    expect(service.isCurrentGeneration(service.captureGeneration())).toBe(true);
  });
});
