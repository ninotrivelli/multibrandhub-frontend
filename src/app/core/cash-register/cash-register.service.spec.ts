import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  makeCashRegisterSession,
  makeCashRegisterSummary,
  makeClosedCashRegisterSession,
  paged,
} from '../../../testing/builders';
import { environment } from '../../../environments/environment';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { CashRegisterService } from './cash-register.service';

describe('CashRegisterService', () => {
  let service: CashRegisterService;
  let sessionState: SessionStateRegistry;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/cash-register`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CashRegisterService);
    sessionState = TestBed.inject(SessionStateRegistry);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the current open register', () => {
    const session = makeCashRegisterSession();
    let result: typeof session | null | undefined;

    service.loadCurrent().subscribe((res) => (result = res));

    expect(service.currentLoading()).toBe(true);
    const req = http.expectOne(`${baseUrl}/current`);
    expect(req.request.method).toBe('GET');
    req.flush(session);

    expect(result).toEqual(session);
    expect(service.current()).toEqual(session);
    expect(service.currentLoaded()).toBe(true);
    expect(service.currentLoading()).toBe(false);
    expect(service.hasOpenRegister()).toBe(true);
  });

  it('stores null when no register is open', () => {
    service.loadCurrent().subscribe();

    const req = http.expectOne(`${baseUrl}/current`);
    expect(req.request.method).toBe('GET');
    req.flush(null);

    expect(service.current()).toBeNull();
    expect(service.currentLoaded()).toBe(true);
    expect(service.hasOpenRegister()).toBe(false);
  });

  it('opens a register with the expected body', () => {
    const session = makeCashRegisterSession({ openingCashAmount: 1500, openingNotes: 'Inicio' });
    let result: typeof session | undefined;

    service.open({ openingCashAmount: 1500, notes: 'Inicio' }).subscribe((res) => (result = res));

    const req = http.expectOne(`${baseUrl}/open`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ openingCashAmount: 1500, notes: 'Inicio' });
    req.flush(session);

    expect(result).toEqual(session);
    expect(service.current()).toEqual(session);
    expect(service.selectedReport()).toBeNull();
  });

  it('closes a register with reported totals and stores the report', () => {
    const closed = makeClosedCashRegisterSession();

    service
      .close('cash-session-1', {
        actualCashAmount: 4300,
        notes: 'Cierre',
        reportedTotals: [
          { brandId: 'brand-own', paymentMethod: 'Cash', reportedAmount: 3300 },
          { brandId: 'brand-a', paymentMethod: 'DebitCard', reportedAmount: 1800 },
        ],
      })
      .subscribe();

    const req = http.expectOne(`${baseUrl}/cash-session-1/close`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      actualCashAmount: 4300,
      notes: 'Cierre',
      reportedTotals: [
        { brandId: 'brand-own', paymentMethod: 'Cash', reportedAmount: 3300 },
        { brandId: 'brand-a', paymentMethod: 'DebitCard', reportedAmount: 1800 },
      ],
    });
    req.flush(closed);

    expect(service.current()).toBeNull();
    expect(service.selectedReport()).toEqual(closed);
  });

  it('loads a report by id', () => {
    const closed = makeClosedCashRegisterSession();

    service.getById('cash-session-closed').subscribe();

    expect(service.reportLoading()).toBe(true);
    const req = http.expectOne(`${baseUrl}/cash-session-closed`);
    expect(req.request.method).toBe('GET');
    req.flush(closed);

    expect(service.selectedReport()).toEqual(closed);
    expect(service.reportLoading()).toBe(false);
  });

  it('loads history with paging and date filters', () => {
    const summary = makeCashRegisterSummary();
    const response = paged([summary], { totalCount: 3, page: 2, pageSize: 20 });

    service
      .loadHistory({ from: '2026-06-01', to: '2026-06-15', page: 2, pageSize: 20 })
      .subscribe();

    const req = http.expectOne((r) => r.url === `${baseUrl}/history`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-06-01');
    expect(req.request.params.get('to')).toBe('2026-06-15');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush(response);

    expect(service.historyItems()).toEqual([summary]);
    expect(service.historyTotalCount()).toBe(3);
    expect(service.historyPage()).toBe(2);
    expect(service.historyPageSize()).toBe(20);
  });

  it('clears cached state on session reset', () => {
    service.loadCurrent().subscribe();
    http.expectOne(`${baseUrl}/current`).flush(makeCashRegisterSession());

    service.loadHistory().subscribe();
    http.expectOne((r) => r.url === `${baseUrl}/history`).flush(paged([makeCashRegisterSummary()]));

    service.getById('cash-session-closed').subscribe();
    http.expectOne(`${baseUrl}/cash-session-closed`).flush(makeClosedCashRegisterSession());

    sessionState.resetAll();

    expect(service.current()).toBeNull();
    expect(service.currentLoaded()).toBe(false);
    expect(service.selectedReport()).toBeNull();
    expect(service.historyItems()).toEqual([]);
    expect(service.historyTotalCount()).toBe(0);
  });
});
