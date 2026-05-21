import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { FraudCase } from '#generated/client/client.ts'
import type { FraudCaseCreateInput, IFraudRepository } from './fraud.repository.ts'
import { getFraudRuleConfigFromEnv } from './fraud.rules.ts'
import { FraudService } from './fraud.service.ts'

function createAppContext(): AppContext {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    config: { environment: 'test' },
  }
}

function fraudCase(input: Partial<FraudCase> = {}): any {
  return {
    id: input.id ?? '11111111-1111-4111-8111-111111111111',
    entityType: input.entityType ?? 'REFUND',
    entityId: input.entityId ?? 'entity-1',
    userId: input.userId ?? 'user-1',
    riskScore: input.riskScore ?? 75,
    riskLevel: input.riskLevel ?? 'high',
    reasons: input.reasons ?? ['high_refund_rate'],
    status: input.status ?? 'OPEN',
    metadata: input.metadata ?? null,
    reviewedById: input.reviewedById ?? null,
    reviewedAt: input.reviewedAt ?? null,
    resolvedById: input.resolvedById ?? null,
    resolvedAt: input.resolvedAt ?? null,
    createdAt: input.createdAt ?? new Date('2026-05-15T00:00:00.000Z'),
    updatedAt: input.updatedAt ?? new Date('2026-05-15T00:00:00.000Z'),
  }
}

function createRepo(): IFraudRepository {
  const cases = new Map<string, FraudCase>()
  return {
    getOrderRiskContext: vi.fn().mockResolvedValue({
      order: {
        id: 'order-1',
        userId: 'user-1',
        checkoutId: 'checkout-1',
        grandTotal: 2500,
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        createdAt: new Date('2026-05-15T00:01:00.000Z'),
        checkout: { createdAt: new Date('2026-05-15T00:00:00.000Z') },
      },
      userOrderCount: 2,
      sameUserFailedPayments: 0,
      sameUserCancelledOrders: 0,
    }),
    getRefundRiskContext: vi.fn().mockResolvedValue({
      refund: {
        id: 'refund-1',
        amount: 1000,
        order: { userId: 'user-1' },
      },
      userOrderCount: 4,
      userRefundCount: 3,
    }),
    getAffiliateRiskContext: vi.fn().mockResolvedValue({
      affiliate: {
        id: 'affiliate-1',
        userId: 'user-1',
        clicks: [{ buyerUserId: 'user-1' }],
        commissions: [],
      },
    }),
    getCouponRiskContext: vi.fn().mockResolvedValue({ couponRedemptionCount: 5 }),
    upsertFraudCase: vi.fn(async (input: FraudCaseCreateInput) => {
      const key = `${input.entityType}:${input.entityId}`
      const existing = cases.get(key)
      const next = fraudCase({
        id: existing?.id ?? 'case-1',
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId ?? null,
        riskScore: input.riskScore,
        riskLevel: input.riskLevel,
        reasons: input.reasons,
        metadata: null,
      })
      cases.set(key, next)
      return next
    }),
    findFraudCaseById: vi.fn(async (caseId: string) => cases.get(`REFUND:refund-1`) ?? fraudCase({ id: caseId })),
    listFraudCases: vi.fn().mockResolvedValue({ items: [fraudCase()], total: 1 }),
    updateFraudCaseReview: vi.fn().mockResolvedValue(fraudCase({
      status: 'REVIEWED',
      reviewedById: 'admin-1',
      reviewedAt: new Date('2026-05-15T01:00:00.000Z'),
    })),
    updateFraudCaseStatus: vi.fn().mockResolvedValue(fraudCase({
      status: 'RESOLVED',
      resolvedById: 'admin-1',
      resolvedAt: new Date('2026-05-15T01:00:00.000Z'),
    })),
  }
}

let repo: IFraudRepository
let service: FraudService

describe('FraudService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepo()
    service = new FraudService(createAppContext(), repo, getFraudRuleConfigFromEnv({}))
  })

  it('high refund rate creates fraud case', async () => {
    const result = await service.evaluateRefundRisk('refund-1')

    expect(result.blocked).toBe(false)
    expect(result.case).toMatchObject({
      entityType: 'REFUND',
      entityId: 'refund-1',
      riskLevel: 'high',
      reasons: ['high_refund_rate'],
    })
    expect(repo.upsertFraudCase).toHaveBeenCalledTimes(1)
  })

  it('repeated failed payments increase risk without blocking order', async () => {
    vi.mocked(repo.getOrderRiskContext).mockResolvedValueOnce({
      order: {
        id: 'order-1',
        userId: 'user-1',
        checkoutId: 'checkout-1',
        grandTotal: 2500,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'FAILED',
        createdAt: new Date('2026-05-15T00:05:00.000Z'),
        checkout: { createdAt: new Date('2026-05-15T00:00:00.000Z') },
      },
      userOrderCount: 10,
      sameUserFailedPayments: 3,
      sameUserCancelledOrders: 0,
    })

    const result = await service.evaluateOrderRisk('order-1')

    expect(result.riskScore).toBeGreaterThan(0)
    expect(result.reasons).toContain('many_failed_payments')
    expect(result.blocked).toBe(false)
  })

  it('coupon abuse creates fraud case', async () => {
    const result = await service.evaluateCouponRisk('user-1', 'coupon-1')

    expect(result.case).toMatchObject({
      entityType: 'COUPON',
      entityId: 'user-1:coupon-1',
      reasons: ['repeated_coupon_abuse'],
    })
  })

  it('affiliate self-referral creates fraud case', async () => {
    const result = await service.evaluateAffiliateRisk('affiliate-1')

    expect(result.case).toMatchObject({
      entityType: 'AFFILIATE',
      entityId: 'affiliate-1',
      reasons: ['affiliate_self_referral'],
    })
  })

  it('duplicate evaluation does not duplicate fraud case identity', async () => {
    const first = await service.evaluateRefundRisk('refund-1')
    const second = await service.evaluateRefundRisk('refund-1')

    expect(first.case?.id).toBe(second.case?.id)
    expect(repo.upsertFraudCase).toHaveBeenCalledTimes(2)
  })

  it('low risk does not block order or create fraud case', async () => {
    const result = await service.evaluateOrderRisk('order-1')

    expect(result).toMatchObject({
      riskLevel: 'low',
      case: null,
      blocked: false,
    })
  })

  it('admin can list fraud cases', async () => {
    const result = await service.listFraudCases({ id: 'admin-1', role: 'ADMIN' }, { page: 1, limit: 10 })

    expect(result.items).toHaveLength(1)
    expect(repo.listFraudCases).toHaveBeenCalledWith({ page: 1, limit: 10 })
  })

  it('non-admin cannot access fraud cases', async () => {
    await expect(service.listFraudCases({ id: 'user-1', role: 'USER' })).rejects.toMatchObject({
      code: 'FRAUD_FORBIDDEN',
    })
  })

  it('admin can review and resolve fraud case', async () => {
    await expect(service.markFraudCaseReviewed('case-1', 'admin-1')).resolves.toMatchObject({
      status: 'REVIEWED',
      reviewedBy: 'admin-1',
    })
    await expect(service.resolveFraudCase('case-1', 'admin-1')).resolves.toMatchObject({
      status: 'RESOLVED',
    })
  })

  it('fraud case response does not expose sensitive metadata', async () => {
    const result = await service.createFraudCase({
      entityType: 'ORDER',
      entityId: 'order-1',
      userId: 'user-1',
      riskScore: 95,
      riskLevel: 'critical',
      reasons: ['abnormal_order_amount'],
      metadata: {
        cardNumber: '4111111111111111',
        token: 'secret',
      },
    })

    expect(JSON.stringify(result)).not.toContain('4111111111111111')
    expect(JSON.stringify(result)).not.toContain('secret')
    expect(result).not.toHaveProperty('metadata')
  })
})
