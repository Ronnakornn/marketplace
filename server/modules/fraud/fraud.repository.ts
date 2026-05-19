import type { FraudCase, Prisma, PrismaClient } from '#generated/client/client.ts'
import type { FraudCaseStatus, FraudEntityType, FraudRiskLevel } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export interface FraudCaseCreateInput {
  entityType: FraudEntityType
  entityId: string
  userId?: string | null
  riskScore: number
  riskLevel: FraudRiskLevel
  reasons: string[]
  metadata?: Record<string, unknown>
}

export interface FraudCaseListInput {
  page: number
  limit: number
  status?: FraudCaseStatus
  riskLevel?: FraudRiskLevel
}

export interface FraudCaseListResult {
  items: FraudCase[]
  total: number
}

export interface FraudOrderRiskContext {
  order: {
    id: string
    userId: string
    checkoutId: string
    grandTotal: number
    status: string
    paymentStatus: string
    createdAt: Date
    checkout: {
      createdAt: Date
    } | null
  } | null
  userOrderCount: number
  sameUserFailedPayments: number
  sameUserCancelledOrders: number
}

export interface FraudRefundRiskContext {
  refund: {
    id: string
    amount: number
    order: {
      userId: string
    }
  } | null
  userOrderCount: number
  userRefundCount: number
}

export interface FraudAffiliateRiskContext {
  affiliate: {
    id: string
    userId: string
    clicks: Array<{
      buyerUserId: string | null
    }>
    commissions: Array<{
      order: {
        userId: string
      }
    }>
  } | null
}

export interface FraudCouponRiskContext {
  couponRedemptionCount: number
}

export interface IFraudRepository {
  getOrderRiskContext(orderId: string): Promise<FraudOrderRiskContext>
  getRefundRiskContext(refundId: string): Promise<FraudRefundRiskContext>
  getAffiliateRiskContext(affiliateId: string): Promise<FraudAffiliateRiskContext>
  getCouponRiskContext(userId: string, couponId: string): Promise<FraudCouponRiskContext>
  upsertFraudCase(input: FraudCaseCreateInput): Promise<FraudCase>
  findFraudCaseById(caseId: string): Promise<FraudCase | null>
  listFraudCases(input: FraudCaseListInput): Promise<FraudCaseListResult>
  updateFraudCaseReview(caseId: string, adminUserId: string, status: FraudCaseStatus): Promise<FraudCase>
  updateFraudCaseStatus(caseId: string, adminUserId: string, status: FraudCaseStatus): Promise<FraudCase>
}

export class PrismaFraudRepository implements IFraudRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  async getOrderRiskContext(orderId: string): Promise<FraudOrderRiskContext> {
    this.logger.debug('PrismaFraudRepository.getOrderRiskContext', { orderId })
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        checkoutId: true,
        grandTotal: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        checkout: { select: { createdAt: true } },
      },
    })
    if (!order) return { order: null, userOrderCount: 0, sameUserFailedPayments: 0, sameUserCancelledOrders: 0 }

    const [userOrderCount, sameUserFailedPayments, sameUserCancelledOrders] = await Promise.all([
      this.prisma.order.count({ where: { userId: order.userId } }),
      this.prisma.payment.count({
        where: {
          status: 'FAILED',
          order: { userId: order.userId },
        },
      }),
      this.prisma.order.count({
        where: {
          userId: order.userId,
          status: 'CANCELED',
        },
      }),
    ])

    return { order, userOrderCount, sameUserFailedPayments, sameUserCancelledOrders }
  }

  async getRefundRiskContext(refundId: string): Promise<FraudRefundRiskContext> {
    this.logger.debug('PrismaFraudRepository.getRefundRiskContext', { refundId })
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true,
        amount: true,
        order: {
          select: {
            userId: true,
          },
        },
      },
    })
    if (!refund) return { refund: null, userOrderCount: 0, userRefundCount: 0 }

    const [userOrderCount, userRefundCount] = await Promise.all([
      this.prisma.order.count({ where: { userId: refund.order.userId } }),
      this.prisma.refund.count({ where: { order: { userId: refund.order.userId } } }),
    ])

    return { refund, userOrderCount, userRefundCount }
  }

  async getAffiliateRiskContext(affiliateId: string): Promise<FraudAffiliateRiskContext> {
    this.logger.debug('PrismaFraudRepository.getAffiliateRiskContext', { affiliateId })
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: {
        id: true,
        userId: true,
        clicks: {
          select: {
            buyerUserId: true,
          },
          take: 100,
          orderBy: { clickedAt: 'desc' },
        },
        commissions: {
          select: {
            order: {
              select: {
                userId: true,
              },
            },
          },
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    return { affiliate }
  }

  async getCouponRiskContext(userId: string, couponId: string): Promise<FraudCouponRiskContext> {
    this.logger.debug('PrismaFraudRepository.getCouponRiskContext', { userId, couponId })
    const couponRedemptionCount = await this.prisma.couponRedemption.count({
      where: { userId, couponId },
    })
    return { couponRedemptionCount }
  }

  upsertFraudCase(input: FraudCaseCreateInput): Promise<FraudCase> {
    this.logger.info('PrismaFraudRepository.upsertFraudCase', {
      entityType: input.entityType,
      entityId: input.entityId,
      riskScore: input.riskScore,
      riskLevel: input.riskLevel,
    })
    return this.prisma.fraudCase.upsert({
      where: {
        entityType_entityId: {
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
      create: {
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId ?? null,
        riskScore: input.riskScore,
        riskLevel: input.riskLevel,
        reasons: input.reasons,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
      update: {
        userId: input.userId ?? null,
        riskScore: input.riskScore,
        riskLevel: input.riskLevel,
        reasons: input.reasons,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    })
  }

  findFraudCaseById(caseId: string): Promise<FraudCase | null> {
    this.logger.debug('PrismaFraudRepository.findFraudCaseById', { caseId })
    return this.prisma.fraudCase.findUnique({ where: { id: caseId } })
  }

  async listFraudCases(input: FraudCaseListInput): Promise<FraudCaseListResult> {
    this.logger.debug('PrismaFraudRepository.listFraudCases', { ...input })
    const where: Prisma.FraudCaseWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.riskLevel ? { riskLevel: input.riskLevel } : {}),
    }
    const [items, total] = await Promise.all([
      this.prisma.fraudCase.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.fraudCase.count({ where }),
    ])
    return { items, total }
  }

  updateFraudCaseReview(caseId: string, adminUserId: string, status: FraudCaseStatus): Promise<FraudCase> {
    this.logger.info('PrismaFraudRepository.updateFraudCaseReview', { caseId, adminUserId, status })
    return this.prisma.fraudCase.update({
      where: { id: caseId },
      data: {
        status,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
    })
  }

  updateFraudCaseStatus(caseId: string, adminUserId: string, status: FraudCaseStatus): Promise<FraudCase> {
    this.logger.info('PrismaFraudRepository.updateFraudCaseStatus', { caseId, adminUserId, status })
    return this.prisma.fraudCase.update({
      where: { id: caseId },
      data: {
        status,
        resolvedBy: adminUserId,
        resolvedAt: new Date(),
      },
    })
  }
}
