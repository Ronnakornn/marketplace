import { describe, it, expect } from 'vitest'
import { normalizeReportFilters, nextScheduleRun } from './reporting.filters.ts'
describe('report time boundaries', () => {
  it('uses exact Bangkok midnight half-open boundaries', () => {
    const range = normalizeReportFilters({
      from: '2026-10-01',
      to: '2026-10-02',
    })
    expect(range.from.toISOString()).toBe('2026-09-30T17:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-10-01T17:00:00.000Z')
  })
  it('supports explicit instants and UTC date boundaries', () => {
    expect(
      normalizeReportFilters({
        from: '2026-10-01',
        to: '2026-10-02',
        timeZone: 'UTC',
      }).from.toISOString(),
    ).toBe('2026-10-01T00:00:00.000Z')
    expect(
      normalizeReportFilters({
        from: '2026-10-01T00:00:00+07:00',
        to: '2026-10-02T00:00:00+07:00',
      }).to.toISOString(),
    ).toBe('2026-10-01T17:00:00.000Z')
  })
  it('rejects invalid dates, inverted ranges and unbounded pagination', () => {
    expect(() =>
      normalizeReportFilters({ from: '2026-02-30', to: '2026-03-10' }),
    ).toThrow('Invalid report date')
    expect(() =>
      normalizeReportFilters({ from: '2026-10-02', to: '2026-10-01' }),
    ).toThrow('positive')
    expect(() => normalizeReportFilters({ page: 0 })).toThrow('pagination')
    expect(() =>
      normalizeReportFilters({ from: '2026-10-01T00:00:00' }),
    ).toThrow('offset')
  })
  it('schedules daily, Monday weekly and first-day monthly without replaying now', () => {
    const now = new Date('2026-10-12T01:00:00Z')
    expect(nextScheduleRun(now, 'DAILY', 8).toISOString()).toBe(
      '2026-10-13T01:00:00.000Z',
    )
    expect(nextScheduleRun(now, 'WEEKLY', 8).toISOString()).toBe(
      '2026-10-19T01:00:00.000Z',
    )
    expect(nextScheduleRun(now, 'MONTHLY', 8).toISOString()).toBe(
      '2026-11-01T01:00:00.000Z',
    )
    expect(
      nextScheduleRun(
        new Date('2026-10-01T00:59:59Z'),
        'MONTHLY',
        8,
      ).toISOString(),
    ).toBe('2026-10-01T01:00:00.000Z')
  })
})
