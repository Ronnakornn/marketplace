import {
  Prisma,
  type PrismaClient,
  type ReportExportJob,
  type ReportSchedule,
} from '#generated/client/client.ts'
import type { AdminActor } from '#server/modules/admin-access/admin-access.contract.ts'
import {
  reportQuery,
  searchQueriesQuery,
  type ReportRow,
} from './reporting.sql.ts'
import type { ReportFilters } from './reporting.filters.ts'
import { ReportingError } from './reporting.errors.ts'

export class AdminReportingRepository {
  constructor(readonly prisma: PrismaClient) {}
  query(filters: ReportFilters, all = false) {
    return this.prisma.$queryRaw<ReportRow[]>(reportQuery(filters, all))
  }
  searchQueries(filters: ReportFilters) {
    return this.prisma.$queryRaw<
      Array<{ query: string; count: bigint; zeroResults: bigint }>
    >(searchQueriesQuery(filters))
  }
  expenses(filters: ReportFilters) {
    return this.prisma.$queryRaw<
      Array<{ currency: string; amount: string }>
    >`SELECT "currency", SUM("amount")::text AS amount FROM "FinanceReconciliation" WHERE "kind" = 'OPERATING_EXPENSE' AND "status" = 'MATCHED' AND "occurredAt" >= ${filters.from.toISOString()}::timestamp AND "occurredAt" < ${filters.to.toISOString()}::timestamp GROUP BY "currency"`
  }
  listJobs(requestedById: string) {
    return this.prisma.reportExportJob.findMany({
      where: { requestedById },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      omit: { result: true },
    })
  }
  findJob(id: string) {
    return this.prisma.reportExportJob.findUnique({ where: { id } })
  }
  async createJob(
    actor: AdminActor,
    data: Pick<
      Prisma.ReportExportJobUncheckedCreateInput,
      'type' | 'format' | 'filters'
    >,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.reportExportJob.create({
        data: {
          ...data,
          requestedById: actor.id,
          expiresAt: new Date(Date.now() + 7 * 86400_000),
        },
      })
      await this.audit(tx, actor, 'CREATE', 'ReportExportJob', job.id, {
        type: job.type,
        format: job.format,
      })
      return job
    })
  }
  listSchedules(requestedById: string) {
    return this.prisma.reportSchedule.findMany({
      where: { requestedById },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    })
  }
  async saveSchedule(
    actor: AdminActor,
    data: Prisma.ReportScheduleUncheckedCreateInput,
    id?: string,
    version?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (id) {
        const updated = await tx.reportSchedule.updateMany({
          where: { id, requestedById: actor.id, version },
          data: { ...data, version: { increment: 1 } },
        })
        if (!updated.count)
          throw new ReportingError(
            'Schedule changed or is unavailable',
            409,
            'STALE_SCHEDULE',
          )
      }
      const schedule = id
        ? await tx.reportSchedule.findUniqueOrThrow({ where: { id } })
        : await tx.reportSchedule.create({ data })
      await this.audit(
        tx,
        actor,
        id ? 'UPDATE' : 'CREATE',
        'ReportSchedule',
        schedule.id,
        {
          name: schedule.name,
          cadence: schedule.cadence,
          version: schedule.version,
          isActive: schedule.isActive,
        },
      )
      return schedule
    })
  }
  async claimJob(id: string, now: Date): Promise<ReportExportJob | null> {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.reportExportJob.updateMany({
        where: {
          id,
          expiresAt: { gt: now },
          OR: [
            { status: { in: ['QUEUED', 'FAILED'] } },
            {
              status: 'PROCESSING',
              claimedAt: { lt: new Date(now.getTime() - 15 * 60_000) },
            },
          ],
        },
        data: { status: 'PROCESSING', claimedAt: now, error: null },
      })
      return changed.count
        ? tx.reportExportJob.findUniqueOrThrow({ where: { id } })
        : null
    })
  }
  async finishJob(job: ReportExportJob, rows: string[][], now: Date) {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.reportExportJob.updateMany({
        where: { id: job.id, status: 'PROCESSING', claimedAt: job.claimedAt },
        data: { status: 'COMPLETED', result: { rows }, updatedAt: now },
      })
      if (changed.count)
        await this.audit(
          tx,
          { id: job.requestedById, role: 'ADMIN' },
          'UPDATE',
          'ReportExportJob',
          job.id,
          { status: 'COMPLETED', rowCount: rows.length - 1 },
        )
    })
  }
  async failJob(job: ReportExportJob, error: string, terminal = false) {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.reportExportJob.updateMany({
        where: { id: job.id, status: 'PROCESSING', claimedAt: job.claimedAt },
        data: {
          status: terminal ? 'EXPIRED' : 'FAILED',
          error: error.slice(0, 500),
        },
      })
      if (changed.count)
        await this.audit(
          tx,
          { id: job.requestedById, role: 'ADMIN' },
          'UPDATE',
          'ReportExportJob',
          job.id,
          {
            status: terminal ? 'EXPIRED' : 'FAILED',
            error: error.slice(0, 500),
          },
        )
    })
  }
  dueSchedules(now: Date) {
    return this.prisma.reportSchedule.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
      orderBy: [{ nextRunAt: 'asc' }, { id: 'asc' }],
      take: 25,
    })
  }
  async enqueueSchedule(schedule: ReportSchedule, nextRunAt: Date, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "ReportSchedule" WHERE "id" = ${schedule.id}::uuid AND "isActive" = true AND "nextRunAt" = ${schedule.nextRunAt} FOR UPDATE SKIP LOCKED`
      if (!locked.length) return null
      const runKey = `${schedule.id}:${schedule.nextRunAt.toISOString()}`
      const job = await tx.reportExportJob.upsert({
        where: { runKey },
        create: {
          requestedById: schedule.requestedById,
          scheduleId: schedule.id,
          runKey,
          type: schedule.type,
          format: schedule.format,
          filters: schedule.filters ?? Prisma.JsonNull,
          expiresAt: new Date(now.getTime() + 7 * 86400_000),
        },
        update: {},
      })
      await tx.reportSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: now, nextRunAt, version: { increment: 1 } },
      })
      await this.audit(
        tx,
        { id: schedule.requestedById, role: 'ADMIN' },
        'CREATE',
        'ReportExportJob',
        job.id,
        { scheduleId: schedule.id, runKey },
      )
      return job
    })
  }
  queuedJobs(now: Date) {
    return this.prisma.reportExportJob.findMany({
      where: {
        expiresAt: { gt: now },
        OR: [
          { status: 'QUEUED' },
          {
            status: 'FAILED',
            updatedAt: { lt: new Date(now.getTime() - 5 * 60_000) },
          },
          {
            status: 'PROCESSING',
            claimedAt: { lt: new Date(now.getTime() - 15 * 60_000) },
          },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 25,
    })
  }
  async pauseRevokedSchedule(schedule: ReportSchedule) {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.reportSchedule.updateMany({
        where: { id: schedule.id, version: schedule.version },
        data: { isActive: false, version: { increment: 1 } },
      })
      if (changed.count)
        await this.audit(
          tx,
          { id: schedule.requestedById, role: 'ADMIN' },
          'UPDATE',
          'ReportSchedule',
          schedule.id,
          {
            isActive: false,
            reason: 'Requester no longer has export permission',
          },
        )
    })
  }
  async audit(
    tx: Prisma.TransactionClient,
    actor: AdminActor,
    action: 'CREATE' | 'UPDATE',
    entityType: string,
    entityId: string,
    after: Prisma.InputJsonValue,
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: 'ADMIN_CONFIG_CHANGED',
        entityType,
        entityId,
        after,
        metadata: { operation: action },
      },
    })
  }
}
export const createAdminReportingRepository = (prisma: PrismaClient) =>
  new AdminReportingRepository(prisma)
