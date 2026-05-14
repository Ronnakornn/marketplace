import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuditLog } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { IAuditLogRepository } from './audit-log.repository.ts'
import { AuditLogService } from './audit-log.service.ts'

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }
}

function createAppContext(): AppContext {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createRepoMock(): IAuditLogRepository {
  return {
    create: vi.fn(async (input) => createAuditLog(input)),
    findById: vi.fn(),
    list: vi.fn(async () => ({ items: [createAuditLog()], total: 1 })),
  }
}

function createAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
    actorUserId: overrides.actorUserId ?? 'admin-1',
    actorRole: overrides.actorRole ?? 'ADMIN',
    action: overrides.action ?? 'USER_STATUS_CHANGED',
    entityType: overrides.entityType ?? 'User',
    entityId: overrides.entityId ?? 'user-1',
    before: overrides.before ?? { status: 'ACTIVE' },
    after: overrides.after ?? { status: 'SUSPENDED' },
    metadata: overrides.metadata ?? { source: 'test' },
    ipAddress: overrides.ipAddress ?? '127.0.0.1',
    userAgent: overrides.userAgent ?? 'vitest',
    createdAt: overrides.createdAt ?? new Date('2026-05-14T00:00:00.000Z'),
  }
}

function adminActor() {
  return { id: 'admin-1', role: 'ADMIN' as const }
}

let repo: IAuditLogRepository
let appContext: AppContext
let service: AuditLogService

describe('AuditLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepoMock()
    appContext = createAppContext()
    service = new AuditLogService(appContext, repo)
  })

  it('lets admins list audit logs', async () => {
    const result = await service.listAuditLogs(adminActor())

    expect(result.items).toHaveLength(1)
    expect(result.pagination).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 })
  })

  it('passes actor, entity, and action filters to the repository', async () => {
    await service.listAuditLogs(adminActor(), {
      actorUserId: 'admin-1',
      entityType: 'Product',
      action: 'PRODUCT_STATUS_CHANGED',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-14T00:00:00.000Z',
    })

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'admin-1',
      entityType: 'Product',
      action: 'PRODUCT_STATUS_CHANGED',
      from: new Date('2026-05-01T00:00:00.000Z'),
      to: new Date('2026-05-14T00:00:00.000Z'),
    }))
  })

  it('supports pagination', async () => {
    vi.mocked(repo.list).mockResolvedValue({ items: [], total: 42 })

    const result = await service.listAuditLogs(adminActor(), { page: 2, limit: 10 })

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 10 }))
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 42, totalPages: 5 })
  })

  it('rejects non-admin actors', async () => {
    await expect(service.listAuditLogs({ id: 'user-1', role: 'USER' }))
      .rejects.toMatchObject({ code: 'AUDIT_LOG_FORBIDDEN' })
  })

  it('rejects invalid filters', async () => {
    await expect(service.listAuditLogs(adminActor(), { action: 'UNKNOWN' }))
      .rejects.toMatchObject({ code: 'INVALID_AUDIT_FILTER' })
  })

  it('does not expose secrets in stored audit JSON', async () => {
    await service.createAuditLog({
      actorUserId: 'admin-1',
      actorRole: 'ADMIN',
      action: 'ADMIN_CONFIG_CHANGED',
      entityType: 'Config',
      entityId: 'auth',
      before: { password: 'old', nested: { accessToken: 'abc', visible: true } },
      after: { password: 'new', nested: { refreshToken: 'def', visible: false } },
      metadata: { cardNumber: '4111111111111111', reason: 'rotation' },
    })

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      before: { password: '[REDACTED]', nested: { accessToken: '[REDACTED]', visible: true } },
      after: { password: '[REDACTED]', nested: { refreshToken: '[REDACTED]', visible: false } },
      metadata: { cardNumber: '[REDACTED]', reason: 'rotation' },
    }))
  })

  it('stores before and after JSON snapshots', async () => {
    await service.createAuditLog({
      actorUserId: 'admin-1',
      actorRole: 'ADMIN',
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: 'user-1',
      before: { status: 'ACTIVE' },
      after: { status: 'SUSPENDED' },
    })

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      before: { status: 'ACTIVE' },
      after: { status: 'SUSPENDED' },
    }))
  })

  it('does not break non-critical business flow when audit creation fails', async () => {
    vi.mocked(repo.create).mockRejectedValue(new Error('database unavailable'))

    await expect(service.createAuditLogBestEffort({
      actorUserId: 'admin-1',
      actorRole: 'ADMIN',
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: 'user-1',
      before: { status: 'ACTIVE' },
      after: { status: 'SUSPENDED' },
      nonCritical: true,
    })).resolves.toBeUndefined()
    expect(appContext.logger.warn).toHaveBeenCalled()
  })
})
