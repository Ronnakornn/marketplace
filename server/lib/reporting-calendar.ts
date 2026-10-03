export const REPORTING_TIME_ZONE = 'Asia/Bangkok'
export const CALENDAR_DAY_MILLISECONDS = 86_400_000

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORTING_TIME_ZONE,
  calendar: 'iso8601',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function calendarParts(date: Date): Record<string, string> {
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
}

export function reportingDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = calendarParts(date)
  return `${parts['year']!.padStart(4, '0')}-${parts['month']}-${parts['day']}`
}

export function parseReportingDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return undefined
  const midnight = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== value) return undefined
  let instant = midnight.getTime()
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = calendarParts(new Date(instant))
    const localAsUtc = new Date(`${parts['year']!.padStart(4, '0')}-${parts['month']}-${parts['day']}T${parts['hour']}:${parts['minute']}:${parts['second']}.000Z`).getTime()
    instant = midnight.getTime() - (localAsUtc - instant)
  }
  return new Date(instant)
}

export function shiftCalendarDate(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function reportingDayRange(date: Date): { from: Date; to: Date } {
  const key = reportingDateKey(date)
  return {
    from: parseReportingDate(key)!,
    to: new Date(parseReportingDate(shiftCalendarDate(key, 1))!.getTime() - 1),
  }
}

export function reportingMonthRange(date: Date): { from: Date; to: Date } {
  const first = `${reportingDateKey(date).slice(0, 7)}-01`
  const next = new Date(`${first}T00:00:00.000Z`)
  next.setUTCMonth(next.getUTCMonth() + 1)
  return {
    from: parseReportingDate(first)!,
    to: new Date(parseReportingDate(next.toISOString().slice(0, 10))!.getTime() - 1),
  }
}
