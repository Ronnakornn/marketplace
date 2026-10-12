import { ReportingError } from './reporting.errors.ts'

export const reportGroups = [
  'day',
  'month',
  'shop',
  'category',
  'product',
  'region',
] as const
export type ReportGroup = (typeof reportGroups)[number]
export interface ReportInput {
  from?: string
  to?: string
  timeZone?: string
  group?: ReportGroup
  shopId?: string
  categoryId?: string
  productId?: string
  region?: string
  page?: number
  limit?: number
}
export interface ReportFilters {
  from: Date
  to: Date
  timeZone: 'Asia/Bangkok' | 'UTC'
  group: ReportGroup
  shopId?: string
  categoryId?: string
  productId?: string
  region?: string
  page: number
  limit: number
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function instant(input: string, zone: ReportFilters['timeZone']): Date {
  const text = /^\d{4}-\d{2}-\d{2}$/.test(input)
    ? `${input}T00:00:00${zone === 'Asia/Bangkok' ? '+07:00' : 'Z'}`
    : input
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(
      text,
    )
  )
    throw new ReportingError(
      'Dates require a date or ISO instant with an explicit offset',
    )
  const value = new Date(text)
  if (!Number.isFinite(value.getTime()))
    throw new ReportingError('Invalid report date')
  const localDate = new Date(
    value.getTime() + (zone === 'Asia/Bangkok' ? 7 * 3600_000 : 0),
  )
    .toISOString()
    .slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(input) && localDate !== input)
    throw new ReportingError('Invalid report date')
  return value
}
export function normalizeReportFilters(
  input: ReportInput = {},
  now = new Date(),
): ReportFilters {
  const zone = input.timeZone ?? 'Asia/Bangkok'
  if (zone !== 'Asia/Bangkok' && zone !== 'UTC')
    throw new ReportingError(
      'Supported report time zones are Asia/Bangkok and UTC',
    )
  const to = input.to ? instant(input.to, zone) : now
  const from = input.from
    ? instant(input.from, zone)
    : new Date(to.getTime() - 30 * 86400_000)
  if (from >= to || to.getTime() - from.getTime() > 3 * 366 * 86400_000)
    throw new ReportingError(
      'Report interval must be positive and at most three years',
    )
  const group = input.group ?? 'day'
  if (!reportGroups.includes(group))
    throw new ReportingError('Invalid report grouping')
  for (const id of [input.shopId, input.categoryId, input.productId])
    if (id !== undefined && !uuid.test(id))
      throw new ReportingError('Invalid report resource ID')
  const page = input.page ?? 1,
    limit = input.limit ?? 25
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100_000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new ReportingError('Invalid report pagination')
  if (input.region && input.region.length > 100)
    throw new ReportingError('Report region is too long')
  return { ...input, from, to, timeZone: zone, group, page, limit }
}
export function storedFilters(filters: ReportFilters) {
  return {
    ...filters,
    from: filters.from.toISOString(),
    to: filters.to.toISOString(),
  }
}

export type ScheduleCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export function nextScheduleRun(
  now: Date,
  cadence: ScheduleCadence,
  hour: number,
): Date {
  if (
    !['DAILY', 'WEEKLY', 'MONTHLY'].includes(cadence) ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23
  )
    throw new ReportingError('Invalid schedule cadence or Bangkok hour')
  const local = new Date(now.getTime() + 7 * 3600_000)
  let next = new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      hour,
    ),
  )
  if (cadence === 'WEEKLY')
    next.setUTCDate(next.getUTCDate() + ((8 - next.getUTCDay()) % 7))
  if (cadence === 'MONTHLY') next.setUTCDate(1)
  const utc = () => new Date(next.getTime() - 7 * 3600_000)
  if (utc() <= now) {
    if (cadence === 'MONTHLY') next.setUTCMonth(next.getUTCMonth() + 1)
    else next.setUTCDate(next.getUTCDate() + (cadence === 'WEEKLY' ? 7 : 1))
  }
  return utc()
}
