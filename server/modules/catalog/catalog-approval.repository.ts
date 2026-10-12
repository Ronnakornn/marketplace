import type { PrismaClient } from '#generated/client/client.ts'
import type {
  AdminActor,
  AdminAuthorizer,
} from '#server/modules/admin-access/admin-access.contract.ts'
import { CatalogServiceError } from './catalog.errors.ts'

export class CatalogApprovalRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly access: AdminAuthorizer,
  ) {}

  async review(
    actor: AdminActor,
    productId: string,
    decision: 'APPROVE' | 'REJECT',
    reason: string,
    expectedUpdatedAt: Date,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(719362804)`
      await this.access.require(actor, 'catalog.write')
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, status: true, updatedAt: true },
      })
      if (
        !product ||
        product.status !== 'PENDING_REVIEW' ||
        product.updatedAt.getTime() !== expectedUpdatedAt.getTime()
      ) {
        throw new CatalogServiceError(
          'Product submission changed; refresh before reviewing',
          409,
          'PRODUCT_PUBLISH_STATUS_INVALID',
        )
      }
      const status = decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED'
      const changed = await tx.product.updateMany({
        where: {
          id: productId,
          status: 'PENDING_REVIEW',
          updatedAt: expectedUpdatedAt,
        },
        data: { status },
      })
      if (changed.count !== 1)
        throw new CatalogServiceError(
          'Product submission changed; refresh before reviewing',
          409,
          'PRODUCT_PUBLISH_STATUS_INVALID',
        )
      const moderation = await tx.moderationCase.create({
        data: {
          entityType: 'PRODUCT',
          entityId: productId,
          status: 'RESOLVED',
          reason: 'POLICY_VIOLATION',
          description: reason,
          resolvedAt: new Date(),
          createdById: actor.id,
        },
      })
      await tx.moderationAction.create({
        data: {
          caseId: moderation.id,
          actorId: actor.id,
          action: decision,
          note: reason,
        },
      })
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorRole: actor.role,
          action: 'PRODUCT_STATUS_CHANGED',
          entityType: 'Product',
          entityId: productId,
          before: { status: product.status },
          after: { status },
          metadata: { reason, moderationAction: decision },
        },
      })
    })
  }
}
