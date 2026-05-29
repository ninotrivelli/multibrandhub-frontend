import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { makeAuthSession } from '../../../testing/builders';
import { AuthSession } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { StoreProfileService } from './store-profile.service';

describe('StoreProfileService', () => {
  let service: StoreProfileService;
  let http: HttpTestingController;
  const session = signal<AuthSession | null>(makeAuthSession());
  const baseUrl = `${environment.apiBaseUrl}/store-profile`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    session.set(makeAuthSession());
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { session: session.asReadonly() } },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(StoreProfileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads and updates profile while tracking loading and saving state', () => {
    service.load().subscribe();
    expect(service.loading()).toBe(true);

    let req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush({
      storeName: 'MultiBrandHub Centro',
      address: null,
      primaryPhone: null,
      secondaryPhone: null,
      contactEmail: null,
      updatedAt: '2026-05-01T00:00:00Z',
    });

    expect(service.loading()).toBe(false);
    expect(service.storeName()).toBe('MultiBrandHub Centro');
    expect(service.hasData()).toBe(true);

    service
      .update({
        storeName: 'MultiBrandHub Pocitos',
        address: 'Av. Brasil 123',
        primaryPhone: null,
        secondaryPhone: null,
        contactEmail: null,
      })
      .subscribe();
    expect(service.saving()).toBe(true);
    req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.storeName).toBe('MultiBrandHub Pocitos');
    req.flush({
      storeName: 'MultiBrandHub Pocitos',
      address: 'Av. Brasil 123',
      primaryPhone: null,
      secondaryPhone: null,
      contactEmail: null,
      updatedAt: '2026-05-02T00:00:00Z',
    });

    expect(service.saving()).toBe(false);
    expect(service.storeName()).toBe('MultiBrandHub Pocitos');
  });

  it('clears profile data when auth session is cleared', () => {
    service.load().subscribe();
    http.expectOne(baseUrl).flush({
      storeName: 'MultiBrandHub Centro',
      address: null,
      primaryPhone: null,
      secondaryPhone: null,
      contactEmail: null,
      updatedAt: '2026-05-01T00:00:00Z',
    });

    session.set(null);
    TestBed.flushEffects();

    expect(service.profile()).toBeNull();
    expect(service.storeName()).toBe('');
  });
});
