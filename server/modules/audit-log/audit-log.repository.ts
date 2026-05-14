import type { AuditLog, Prisma, PrismaClient } from '#generated/client/client.ts'
import type { AuditAction } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CreateAuditLogInput, NormalizedAuditLogQuery } from './audit-log.types.ts'

export interface AuditLogPaginatedResult {
  items: AuditLog[]
  total: number
}

export interface IAuditLogRepository {
  create(input: CreateAuditLogInput): Promise<AuditLog>
  findById(auditLogId: string): Promise<AuditLog | null>
  list(input: NormalizedAuditLogQuery): Promise<AuditLogPaginatedResult>
}

export class PrismaAuditLogRepository implements IAuditLogRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  create(input: CreateAuditLogInput): Promise<AuditLog> {
    this.logger.info('PrismaAuditLogRepository.create', {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    })
    return this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before as Prisma.InputJsonValue | undefined,
        after: input.after as Prisma.InputJsonValue | undefined,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
  }

  findById(auditLogId: string): Promise<AuditLog | null> {
    this.logger.debug('PrismaAuditLogRepository.findById', { auditLogId })
    return this.prisma.auditLog.findUnique({
      where: { id: auditLogId },
    })
  }

  async list(input: NormalizedAuditLogQuery): Promise<AuditLogPaginatedResult> {
    const where = this.toWhere(input)
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ])
    return { items, total }
  }

  private toWhere(input: NormalizedAuditLogQuery): Prisma.AuditLogWhereInput {
    return {
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(input.action ? { action: input.action as AuditAction } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...((input.from || input.to)
        ? {
            createdAt: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
    }
  }
}

export type AuditLogRecord = AuditLog
