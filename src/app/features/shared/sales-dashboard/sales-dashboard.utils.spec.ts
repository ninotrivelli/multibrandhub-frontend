import {
  clampWeekStart,
  currentMonthRange,
  defaultWeekStartForRange,
  periodOptionsForCurrentYear,
  periodRangeForPreset,
  previousMonthRange,
  startOfWeekMonday,
  weekNavigationBounds,
} from './sales-dashboard.utils';

describe('sales dashboard date utilities', () => {
  it('builds the default current-month range through today', () => {
    expect(currentMonthRange('2026-04-26')).toEqual({
      startDate: '2026-04-01',
      endDate: '2026-04-26',
    });
  });

  it('builds the complete previous-month range', () => {
    expect(previousMonthRange('2026-04-26')).toEqual({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });
  });

  it('builds current-year period options with named previous months', () => {
    expect(periodOptionsForCurrentYear('2026-06-05')).toEqual([
      { label: 'Mes actual (Junio)', value: 'currentMonth' },
      { label: 'Mayo', value: 'month:2026-05' },
      { label: 'Abril', value: 'month:2026-04' },
      { label: 'Marzo', value: 'month:2026-03' },
      { label: 'Febrero', value: 'month:2026-02' },
      { label: 'Enero', value: 'month:2026-01' },
      { label: 'Personalizado', value: 'custom' },
    ]);
  });

  it('builds the complete range for a selected month preset', () => {
    expect(periodRangeForPreset('month:2026-02', '2026-06-05')).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
  });

  it('uses Monday as the start of the weekly chart', () => {
    expect(startOfWeekMonday('2026-04-26')).toBe('2026-04-20');
    expect(startOfWeekMonday('2026-04-27')).toBe('2026-04-27');
  });

  it('caps current ranges to four weeks back from the current week', () => {
    expect(weekNavigationBounds('2026-03-01', '2026-04-26', '2026-04-26')).toEqual({
      minWeekStart: '2026-03-23',
      maxWeekStart: '2026-04-20',
    });
  });

  it('allows older ranges to navigate inside their own weeks', () => {
    expect(weekNavigationBounds('2026-02-10', '2026-02-28', '2026-04-26')).toEqual({
      minWeekStart: '2026-02-09',
      maxWeekStart: '2026-02-23',
    });
    expect(defaultWeekStartForRange('2026-02-10', '2026-02-28', '2026-04-26')).toBe(
      '2026-02-23',
    );
  });

  it('clamps week navigation to the valid range', () => {
    expect(clampWeekStart('2026-02-02', '2026-02-10', '2026-02-28', '2026-04-26')).toBe(
      '2026-02-09',
    );
    expect(clampWeekStart('2026-03-02', '2026-02-10', '2026-02-28', '2026-04-26')).toBe(
      '2026-02-23',
    );
  });
});
