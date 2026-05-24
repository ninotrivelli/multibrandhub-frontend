import { TestBed } from '@angular/core/testing';

import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
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
});
