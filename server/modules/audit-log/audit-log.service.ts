import type { AuditAction } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { AuditLogServiceError } from './audit-log.errors.ts'
import type { AuditLogRecord, IAuditLogRepository } from './audit-log.repository.ts'
import {
  auditActions,
  type AuditActor,
  type AuditLogQueryInput,
  type CreateAuditLogInput,
  type NormalizedAuditLogQuery,
} from './audit-log.types.ts'

const secretKeyPattern = /(password|token|secret|authorization|card|cvv|cvc|pan|refreshToken|accessToken)/i

export interface AuditLogListResponse {
  items: AuditLogResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AuditLogResponse {
  id: string
  actorUserId: string | null
  actorRole: string
  action: string
  entityType: string
  entityId: string
  before: unknown
  after: unknown
  metadata: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

export class AuditLogService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IAuditLogRepository,
  ) {
    this.logger = appContext.logger
  }

  async listAuditLogs(actor: AuditActor, input: AuditLogQueryInput = {}): Promise<AuditLogListResponse> {
    this.assertAdmin(actor)
    const query = this.normalizeQuery(input)
    const result = await this.repo.list(query)
    return {
      items: result.items.map((item) => this.toResponse(item)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: result.total === 0 ? 0 : Math.ceil(result.total / query.limit),
      },
    }
  }

  async getAuditLog(actor: AuditActor, auditLogId: string): Promise<AuditLogResponse> {
    this.assertAdmin(actor)
    const auditLog = await this.repo.findById(auditLogId)
    if (!auditLog) throw new AuditLogServiceError('Audit log not found', 404, 'AUDIT_LOG_NOT_FOUND')
    return this.toResponse(auditLog)
  }

  async createAuditLog(input: CreateAuditLogInput): Promise<AuditLogResponse> {
    const auditLog = await this.repo.create({
      ...input,
      before: this.redact(input.before),
      after: this.redact(input.after),
      metadata: this.redact(input.metadata),
    })
    return this.toResponse(auditLog)
  }

  async createAuditLogBestEffort(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.createAuditLog(input)
    } catch (error) {
      this.logger.warn('AuditLogService best-effort audit creation failed', {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        error: error instanceof Error ? error.message : String(error),
      })
      if (!input.nonCritical) throw error
    }
  }

  private assertAdmin(actor: AuditActor): void {
    if (actor.role !== 'ADMIN') {
      throw new AuditLogServiceError('Audit log access requires admin role', 403, 'AUDIT_LOG_FORBIDDEN')
    }
  }

  private normalizeQuery(input: AuditLogQueryInput): NormalizedAuditLogQuery {
    const page = Number(input.page ?? 1)
    const requestedLimit = Number(input.limit ?? 20)
    const limit = Math.min(requestedLimit, 100)
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(requestedLimit) || requestedLimit < 1) {
      throw new AuditLogServiceError('Invalid audit pagination filter', 400, 'INVALID_AUDIT_FILTER')
    }

    const action = input.action === undefined ? undefined : this.parseAction(input.action)
    const from = input.from === undefined ? undefined : this.parseDate(input.from, 'from')
    const to = input.to === undefined ? undefined : this.parseDate(input.to, 'to')
    if (from && to && from > to) {
      throw new AuditLogServiceError('Invalid audit date range', 400, 'INVALID_AUDIT_FILTER')
    }

    return {
      actorUserId: this.normalizeOptionalString(input.actorUserId),
      action,
      entityType: this.normalizeOptionalString(input.entityType),
      entityId: this.normalizeOptionalString(input.entityId),
      from,
      to,
      page,
      limit,
    }
  }

  private parseAction(action: string): AuditAction {
    if (!auditActions.includes(action as AuditAction)) {
      throw new AuditLogServiceError('Invalid audit action filter', 400, 'INVALID_AUDIT_FILTER')
    }
    return action as AuditAction
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      throw new AuditLogServiceError('Invalid audit date filter', 400, 'INVALID_AUDIT_FILTER', { field })
    }
    return date
  }

  private normalizeOptionalString(value: string | undefined): string | undefined {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
  }

  private redact(value: unknown): unknown {
    if (value === null || value === undefined) return null
    if (Array.isArray(value)) return value.map((item) => this.redact(item))
    if (value instanceof Date) return value.toISOString()
    if (typeof value !== 'object') return value

    const redacted: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      redacted[key] = secretKeyPattern.test(key) ? '[REDACTED]' : this.redact(nestedValue)
    }
    return redacted
  }

  private toResponse(auditLog: AuditLogRecord): AuditLogResponse {
    return {
      id: auditLog.id,
      actorUserId: auditLog.actorUserId,
      actorRole: auditLog.actorRole,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      before: auditLog.before,
      after: auditLog.after,
      metadata: auditLog.metadata,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
      createdAt: auditLog.createdAt,
    }
  }
}
