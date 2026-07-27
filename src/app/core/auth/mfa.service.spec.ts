import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { HANDLE_ERROR_LOCALLY } from '../http/local-error-handling';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { MfaService } from './mfa.service';

describe('MfaService', () => {
  let service: MfaService;
  let http: HttpTestingController;
  let sessionState: SessionStateRegistry;
  const baseUrl = `${environment.apiBaseUrl}/auth/mfa`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MfaService);
    http = TestBed.inject(HttpTestingController);
    sessionState = TestBed.inject(SessionStateRegistry);
  });

  afterEach(() => http.verify());

  it('loads and caches the non-sensitive MFA status until forced or the session resets', () => {
    const status = {
      enrollmentAvailable: false,
      enabled: true,
      enabledAtUtc: '2026-07-20T18:00:00Z',
      recoveryCodesRemaining: 7,
    };

    service.loadStatus().subscribe();
    http.expectOne(`${baseUrl}/status`).flush(status);
    expect(service.status()).toEqual(status);

    service.loadStatus().subscribe();
    http.expectNone(`${baseUrl}/status`);

    service.loadStatus(true).subscribe();
    http.expectOne(`${baseUrl}/status`).flush({ ...status, recoveryCodesRemaining: 6 });
    expect(service.status()?.recoveryCodesRemaining).toBe(6);

    sessionState.resetAll();
    expect(service.status()).toBeNull();
  });

  it('uses the exact setup and confirmation contracts with local form errors', () => {
    service.startSetup('Password!123').subscribe();
    let request = http.expectOne(`${baseUrl}/setup`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ currentPassword: 'Password!123' });
    expect(request.request.context.get(HANDLE_ERROR_LOCALLY)).toBe(true);
    request.flush({
      manualEntryKey: 'BASE32SECRET',
      otpAuthUri: 'otpauth://totp/example',
      expiresAtUtc: '2026-07-20T18:10:00Z',
    });

    service.confirmSetup('123456').subscribe();
    request = http.expectOne(`${baseUrl}/setup/confirm`);
    expect(request.request.body).toEqual({ code: '123456' });
    expect(request.request.context.get(HANDLE_ERROR_LOCALLY)).toBe(true);
    request.flush({
      recoveryCodes: ['AAAA-BBBB-CCCC-DDDD'],
      enabledAtUtc: '2026-07-20T18:00:00Z',
      sessionInvalidated: true,
    });
  });

  it('uses the exact reauthentication contract for regeneration and disable', () => {
    const body = {
      currentPassword: 'Password!123',
      verificationCode: 'AAAA-BBBB-CCCC-DDDD',
      method: 'RecoveryCode' as const,
    };

    service.regenerateRecoveryCodes(body).subscribe();
    let request = http.expectOne(`${baseUrl}/recovery-codes/regenerate`);
    expect(request.request.body).toEqual(body);
    expect(request.request.context.get(HANDLE_ERROR_LOCALLY)).toBe(true);
    request.flush({ recoveryCodes: [], enabledAtUtc: null, sessionInvalidated: false });

    service.disable(body).subscribe();
    request = http.expectOne(`${baseUrl}/disable`);
    expect(request.request.body).toEqual(body);
    expect(request.request.context.get(HANDLE_ERROR_LOCALLY)).toBe(true);
    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});
