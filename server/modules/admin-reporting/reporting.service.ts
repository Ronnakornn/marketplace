import { z } from 'zod'
import type {
  AdminActor,
  AdminAuthorizer,
} from '#server/modules/admin-access/admin-access.contract.ts'
import { AdminReportingRepository } from './reporting.repository.ts'
import {
  normalizeReportFilters,
  storedFilters,
  nextScheduleRun,
  type ReportInput,
  type ScheduleCadence,
} from './reporting.filters.ts'
import { ReportingError } from './reporting.errors.ts'
import { writeTabularFile, type TabularFormat } from './spreadsheet.ts'

const savedInput = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  timeZone: z.enum(['Asia/Bangkok', 'UTC']).optional(),
  group: z
    .enum(['day', 'month', 'shop', 'category', 'product', 'region'])
    .optional(),
  shopId: z.string().optional(),
  categoryId: z.string().optional(),
  productId: z.string().optional(),
  region: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
})
const exportResult = z.object({
  rows: z.array(z.array(z.string().max(10_000)).max(40)).max(10_001),
})
export interface ScheduleInput {
  name: string
  type: 'SALES'
  format: TabularFormat
  filters: ReportInput
  cadence: ScheduleCadence
  hour: number
  isActive?: boolean
}
const metrics = [
  'gmv',
  'paidMerchandise',
  'shipping',
  'tax',
  'discount',
  'refund',
  'originalCommission',
  'commissionReversal',
  'platformFunding',
  'fundingReversal',
  'contribution',
] as const

export class AdminReportingService {
  constructor(
    private repo: AdminReportingRepository,
    private authorizer: AdminAuthorizer,
  ) {}
  async query(actor: AdminActor, input: ReportInput = {}) {
    await this.authorizer.require(actor, 'reports.read')
    const filters = normalizeReportFilters(input)
    const expenseScopeAvailable =
      !filters.shopId &&
      !filters.categoryId &&
      !filters.productId &&
      !filters.region
    const [rows, searches, monthly, expenses] = await Promise.all([
      this.repo.query(filters),
      this.repo.searchQueries(filters),
      this.repo.query({ ...filters, group: 'month' }, true),
      expenseScopeAvailable ? this.repo.expenses(filters) : Promise.resolve([]),
    ])
    const currencies = [
      ...new Set([
        ...monthly.map((row) => row.currency),
        ...expenses.map((row) => row.currency),
      ]),
    ]
    const totals = currencies.map((currency) => {
      const scoped = monthly.filter((row) => row.currency === currency)
      const sum = (metric: (typeof metrics)[number]) =>
        scoped.reduce((total, row) => total + BigInt(row[metric]), 0n)
      const recordedExpenses = expenseScopeAvailable
        ? BigInt(
            expenses.find((row) => row.currency === currency)?.amount ?? '0',
          )
        : null
      return {
        currency,
        orders: scoped.reduce((total, row) => total + row.orders, 0n),
        units: scoped.reduce((total, row) => total + row.units, 0n),
        snapshotMissing: scoped.reduce(
          (total, row) => total + row.snapshotMissing,
          0n,
        ),
        gmv: sum('gmv'),
        paidMerchandise: sum('paidMerchandise'),
        shipping: sum('shipping'),
        tax: sum('tax'),
        discount: sum('discount'),
        refund: sum('refund'),
        originalCommission: sum('originalCommission'),
        commissionReversal: sum('commissionReversal'),
        platformFunding: sum('platformFunding'),
        fundingReversal: sum('fundingReversal'),
        contribution: sum('contribution'),
        recordedExpenses,
        operatingContribution:
          recordedExpenses === null
            ? null
            : sum('contribution') - recordedExpenses,
      }
    })
    const firstPage =
      !rows.length && filters.page > 1
        ? await this.repo.query({ ...filters, page: 1, limit: 1 })
        : rows
    return {
      filters: storedFilters(filters),
      items: rows.map(({ totalCount, ...row }) => row),
      total: firstPage[0]?.totalCount ?? 0n,
      totals,
      searchQueries: searches,
      definitions: {
        interval: '[from,to)',
        salesDate: 'Order.createdAt',
        refundDate: 'Refund.completedAt',
        category: 'Current catalog category',
        gmv: 'Paid non-canceled purchased merchandise before discounts',
        commission: 'Original purchase commission less successful reversals',
        contribution:
          'Original commission minus commission reversals and known platform funding plus funding reversals; excludes operating expenses',
        operatingContribution:
          'Contribution less matched recorded operating expenses by occurredAt; omits unrecorded costs and is unavailable under shop, category, product or region filters',
        allocation:
          'Shipping, reported tax and original fees use exact cumulative purchase-line allocation',
        currency: 'Currencies remain separate',
        missingSnapshots:
          'Missing purchase snapshots are counted; original fee and funding are unavailable for these lines',
      },
    }
  }
  async requestExport(
    actor: AdminActor,
    input: { type: 'SALES'; format: TabularFormat; filters: ReportInput },
  ) {
    await this.authorizer.require(actor, 'reports.export')
    const filters = normalizeReportFilters(input.filters)
    const job = await this.repo.createJob(actor, {
      type: input.type,
      format: input.format,
      filters: storedFilters(filters),
    })
    await this.processExport(job.id)
    const { result, ...projection } = (await this.repo.findJob(job.id))!
    return projection
  }
  async listJobs(actor: AdminActor) {
    await this.authorizer.require(actor, 'reports.export')
    return this.repo.listJobs(actor.id)
  }
  async download(actor: AdminActor, id: string) {
    await this.authorizer.require(actor, 'reports.export')
    const job = await this.repo.findJob(id)
    if (!job || job.requestedById !== actor.id)
      throw new ReportingError('Export not found', 404, 'EXPORT_NOT_FOUND')
    if (!job.expiresAt || job.expiresAt <= new Date())
      throw new ReportingError('Export expired', 410, 'EXPORT_EXPIRED')
    if (job.status !== 'COMPLETED' || job.format === 'PDF')
      throw new ReportingError('Export is not ready', 409, 'EXPORT_NOT_READY')
    return {
      bytes: writeTabularFile(exportResult.parse(job.result).rows, job.format),
      format: job.format,
      filename: `sales-${job.id}.${job.format.toLowerCase()}`,
    }
  }
  async processExport(id: string, now = new Date()) {
    const job = await this.repo.claimJob(id, now)
    if (!job) return
    try {
      await this.authorizer.require(
        { id: job.requestedById, role: 'ADMIN' },
        'reports.export',
      )
      if (job.type !== 'SALES' || job.format === 'PDF')
        throw new ReportingError('Unsupported report export')
      const filters = normalizeReportFilters(savedInput.parse(job.filters), now)
      const items = await this.repo.query(filters, true)
      if (items.length > 10_000)
        throw new ReportingError(
          'Export exceeds 10,000 groups; narrow its filters',
        )
      const rows = [
        [
          'group',
          'label',
          'currency',
          'orders',
          'units',
          ...metrics,
          'missingSnapshots',
        ],
        ...items.map((item) => [
          item.key,
          item.label,
          item.currency,
          item.orders.toString(),
          item.units.toString(),
          ...metrics.map((metric) => item[metric]),
          item.snapshotMissing.toString(),
        ]),
      ]
      // Validate output size before persisting a ready job.
      writeTabularFile(rows, job.format)
      await this.repo.finishJob(job, rows, now)
    } catch (error) {
      await this.repo.failJob(
        job,
        error instanceof Error ? error.message : 'Export failed',
        error instanceof Error && 'status' in error && error.status === 403,
      )
    }
  }
  async listSchedules(actor: AdminActor) {
    await this.authorizer.require(actor, 'reports.export')
    return (await this.repo.listSchedules(actor.id)).map((schedule) => ({
      ...schedule,
      filters: savedInput.parse(schedule.filters),
    }))
  }
  async saveSchedule(
    actor: AdminActor,
    input: ScheduleInput,
    id?: string,
    version?: number,
    now = new Date(),
  ) {
    await this.authorizer.require(actor, 'reports.export')
    if (!input.name.trim() || input.name.length > 120)
      throw new ReportingError('Schedule name is required')
    // Schedules retain a rolling interval. Explicit dates are validated but omitted.
    normalizeReportFilters(input.filters, now)
    const { from, to, ...filters } = input.filters
    const nextRunAt = nextScheduleRun(now, input.cadence, input.hour)
    return this.repo.saveSchedule(
      actor,
      {
        name: input.name.trim(),
        type: input.type,
        format: input.format,
        filters,
        cadence: input.cadence,
        hour: input.hour,
        timeZone: 'Asia/Bangkok',
        isActive: input.isActive ?? true,
        requestedById: actor.id,
        nextRunAt,
      },
      id,
      version,
    )
  }
  async processDueSchedules(now = new Date()) {
    const schedules = await this.repo.dueSchedules(now)
    for (const schedule of schedules) {
      try {
        await this.authorizer.require(
          { id: schedule.requestedById, role: 'ADMIN' },
          'reports.export',
        )
        const cadence = z
          .enum(['DAILY', 'WEEKLY', 'MONTHLY'])
          .parse(schedule.cadence)
        const next = nextScheduleRun(now, cadence, schedule.hour)
        const job = await this.repo.enqueueSchedule(schedule, next, now)
        if (job) await this.processExport(job.id, now)
      } catch (error) {
        if (
          error instanceof Error &&
          'status' in error &&
          error.status === 403
        ) {
          await this.repo.pauseRevokedSchedule(schedule)
          continue
        }
        throw error
      }
    }
    for (const job of await this.repo.queuedJobs(now))
      await this.processExport(job.id, now)
    return { checked: schedules.length }
  }
}
export const createAdminReportingService = (
  repo: AdminReportingRepository,
  authorizer: AdminAuthorizer,
) => new AdminReportingService(repo, authorizer)
