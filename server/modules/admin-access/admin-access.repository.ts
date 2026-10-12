import type { Prisma, PrismaClient } from '#generated/client/client.ts'
import type { AdminActor } from './admin-access.contract.ts'

export class AdminAccessRepository {
  constructor(private readonly prisma: PrismaClient) {}
  member(userId: string) {
    return this.prisma.adminTeamMember.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            emailVerified: true,
          },
        },
      },
    })
  }
  list(page: number, limit: number) {
    const where = {}
    return this.prisma
      .$transaction([
        this.prisma.adminTeamMember.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                emailVerified: true,
              },
            },
          },
          orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.adminTeamMember.count({ where }),
      ])
      .then(([items, total]) => ({ items, total, page, limit }))
  }
  rules(page: number, limit: number) {
    return this.prisma
      .$transaction([
        this.prisma.adminAccessRule.findMany({
          orderBy: [{ priority: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.adminAccessRule.count(),
      ])
      .then(([items, total]) => ({ items, total, page, limit }))
  }
  activeRules(now: Date) {
    return this.prisma.adminAccessRule.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ priority: 'desc' }, { id: 'asc' }],
      take: 1001,
    })
  }
  async locked<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(719362804)`
      return operation(tx)
    })
  }
}

export function auditAccess(
  tx: Prisma.TransactionClient,
  actor: AdminActor,
  entityType: string,
  entityId: string,
  before: Prisma.InputJsonValue,
  after: Prisma.InputJsonValue,
) {
  return tx.auditLog.create({
    data: {
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'ADMIN_CONFIG_CHANGED',
      entityType,
      entityId,
      before,
      after,
    },
  })
}
