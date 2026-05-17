import type { FraudCase } from '#generated/client/client.ts'
import type { FraudCaseStatus, FraudEntityType, FraudRiskLevel } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { AuditLogService } from '#server/modules/audit-log'
import { FraudServiceError } from './fraud.errors.ts'
import type { IFraudRepository } from './fraud.repository.ts'
import { evaluateFraudRules, type FraudRuleConfig, type FraudSignalInput } from './fraud.rules.ts'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const secretKeyPattern = /(password|token|secret|authorization|card|cvv|cvc|pan|refreshToken|accessToken)/i

export interface FraudActor {
  id: string
  role: string
}

export interface FraudEvaluationResult {
  riskScore: number
  riskLevel: FraudRiskLevel
  reasons: string[]
  case: FraudCaseResponse | null
  blocked: false
}

export interface FraudCasePayload {
  entityType: FraudEntityType
  entityId: string
  userId?: string | null
  riskScore: number
  riskLevel: FraudRiskLevel
  reasons: string[]
  metadata?: Record<string, unknown>
}

export interface FraudCaseListQuery {
  page?: number
  limit?: number
  status?: string
  riskLevel?: string
}

export interface FraudCaseListResponse {
  items: FraudCaseResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface FraudCaseResponse {
  id: string
  entityType: FraudEntityType
  entityId: string
  userId: string | null
  riskScore: number
  riskLevel: FraudRiskLevel
  reasons: string[]
  status: FraudCaseStatus
  reviewedBy: string | null
  reviewedAt: Date | null
  createdAt: Date
}

export class FraudService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IFraudRepository,
    private rules: FraudRuleConfig,
    private auditLogService?: AuditLogService,
  ) {
    this.logger = appContext.logger
  }

  async evaluateOrderRisk(orderId: string): Promise<FraudEvaluationResult> {
    try {
      const context = await this.repo.getOrderRiskContext(orderId)
      if (!context.order) return this.lowRisk()

      const checkoutDurationSeconds = context.order.checkout
        ? Math.max(0, Math.round((context.order.createdAt.getTime() - context.order.checkout.createdAt.getTime()) / 1000))
        : null
      const signals: FraudSignalInput = {
        failedPayments: context.sameUserFailedPayments,
        cancelledOrders: context.sameUserCancelledOrders,
        orderAmountCents: context.order.grandTotalCents,
        checkoutDurationSeconds,
      }

      return this.createEvaluationResult('ORDER', orderId, context.order.userId, signals)
    } catch (error) {
      this.logger.error('FraudService.evaluateOrderRisk failed', {
        code: 'FRAUD_EVALUATION_FAILED',
        orderId,
        error: error instanceof Error ? error.message : String(error),
      })
      if (error instanceof FraudServiceError) throw error
      throw new FraudServiceError('Fraud order evaluation failed', 500, 'FRAUD_EVALUATION_FAILED')
    }
  }

  async evaluateRefundRisk(refundId: string): Promise<FraudEvaluationResult> {
    try {
      const context = await this.repo.getRefundRiskContext(refundId)
      if (!context.refund) return this.lowRisk()
      const refundRate = context.userOrderCount === 0 ? 0 : context.userRefundCount / context.userOrderCount
      const signals: FraudSignalInput = {
        refundCount: context.userRefundCount,
        refundRate,
      }

      return this.createEvaluationResult('REFUND', refundId, context.refund.order.userId, signals)
    } catch (error) {
      this.logger.error('FraudService.evaluateRefundRisk failed', {
        code: 'FRAUD_EVALUATION_FAILED',
        refundId,
        error: error instanceof Error ? error.message : String(error),
      })
      if (error instanceof FraudServiceError) throw error
      throw new FraudServiceError('Fraud refund evaluation failed', 500, 'FRAUD_EVALUATION_FAILED')
    }
  }

  async evaluateAffiliateRisk(affiliateId: string): Promise<FraudEvaluationResult> {
    try {
      const context = await this.repo.getAffiliateRiskContext(affiliateId)
      if (!context.affiliate) return this.lowRisk()
      const affiliateSelfReferral = context.affiliate.clicks.some((click) => click.buyerUserId === context.affiliate!.userId) ||
        context.affiliate.commissions.some((commission) => commission.order.userId === context.affiliate!.userId)

      return this.createEvaluationResult('AFFILIATE', affiliateId, context.affiliate.userId, { affiliateSelfReferral })
    } catch (error) {
      this.logger.error('FraudService.evaluateAffiliateRisk failed', {
        code: 'FRAUD_EVALUATION_FAILED',
        affiliateId,
        error: error instanceof Error ? error.message : String(error),
      })
      if (error instanceof FraudServiceError) throw error
      throw new FraudServiceError('Fraud affiliate evaluation failed', 500, 'FRAUD_EVALUATION_FAILED')
    }
  }

  async evaluateCouponRisk(userId: string, couponId: string): Promise<FraudEvaluationResult> {
    try {
      const context = await this.repo.getCouponRiskContext(userId, couponId)
      return this.createEvaluationResult('COUPON', `${userId}:${couponId}`, userId, {
        repeatedCouponUse: context.couponRedemptionCount,
      })
    } catch (error) {
      this.logger.error('FraudService.evaluateCouponRisk failed', {
        code: 'FRAUD_EVALUATION_FAILED',
        userId,
        couponId,
        error: error instanceof Error ? error.message : String(error),
      })
      if (error instanceof FraudServiceError) throw error
      throw new FraudServiceError('Fraud coupon evaluation failed', 500, 'FRAUD_EVALUATION_FAILED')
    }
  }

  async createFraudCase(payload: FraudCasePayload): Promise<FraudCaseResponse> {
    const created = await this.repo.upsertFraudCase({
      entityType: payload.entityType,
      entityId: payload.entityId,
      userId: payload.userId ?? null,
      riskScore: payload.riskScore,
      riskLevel: payload.riskLevel,
      reasons: [...new Set(payload.reasons)],
      metadata: this.sanitizeMetadata(payload.metadata),
    })
    this.logger.warn('Fraud case created or updated', {
      entityType: payload.entityType,
      entityId: payload.entityId,
      userId: payload.userId ?? null,
      riskScore: payload.riskScore,
      riskLevel: payload.riskLevel,
      reasons: payload.reasons,
    })
    return this.toResponse(created)
  }

  async listFraudCases(actor: FraudActor, input: FraudCaseListQuery = {}): Promise<FraudCaseListResponse> {
    this.assertAdmin(actor)
    const query = this.normalizeListQuery(input)
    const result = await this.repo.listFraudCases(query)
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

  async getFraudCase(actor: FraudActor, caseId: string): Promise<FraudCaseResponse> {
    this.assertAdmin(actor)
    const fraudCase = await this.repo.findFraudCaseById(caseId)
    if (!fraudCase) throw new FraudServiceError('Fraud case not found', 404, 'FRAUD_CASE_NOT_FOUND')
    return this.toResponse(fraudCase)
  }

  async markFraudCaseReviewed(caseId: string, adminUserId: string): Promise<FraudCaseResponse> {
    const fraudCase = await this.repo.findFraudCaseById(caseId)
    if (!fraudCase) throw new FraudServiceError('Fraud case not found', 404, 'FRAUD_CASE_NOT_FOUND')
    if (fraudCase.status === 'RESOLVED' || fraudCase.status === 'DISMISSED') {
      throw new FraudServiceError('Resolved fraud cases cannot be reviewed again', 400, 'INVALID_FRAUD_STATUS')
    }
    const updated = await this.repo.updateFraudCaseReview(caseId, adminUserId, 'REVIEWED')
    await this.auditBestEffort(adminUserId, 'FRAUD_CASE_REVIEWED', updated)
    return this.toResponse(updated)
  }

  async resolveFraudCase(caseId: string, adminUserId: string, status: string = 'RESOLVED'): Promise<FraudCaseResponse> {
    const normalizedStatus = this.parseResolveStatus(status)
    const fraudCase = await this.repo.findFraudCaseById(caseId)
    if (!fraudCase) throw new FraudServiceError('Fraud case not found', 404, 'FRAUD_CASE_NOT_FOUND')
    if (fraudCase.status === 'RESOLVED' || fraudCase.status === 'DISMISSED') {
      throw new FraudServiceError('Fraud case is already resolved', 400, 'INVALID_FRAUD_STATUS')
    }
    const updated = await this.repo.updateFraudCaseStatus(caseId, adminUserId, normalizedStatus)
    await this.auditBestEffort(adminUserId, 'FRAUD_CASE_RESOLVED', updated)
    return this.toResponse(updated)
  }

  private async createEvaluationResult(
    entityType: FraudEntityType,
    entityId: string,
    userId: string | null,
    signals: FraudSignalInput,
  ): Promise<FraudEvaluationResult> {
    const ruleResult = evaluateFraudRules(signals, this.rules)
    if (ruleResult.reasons.length > 0) {
      this.logger.warn('Suspicious activity detected', {
        entityType,
        entityId,
        userId,
        riskScore: ruleResult.riskScore,
        riskLevel: ruleResult.riskLevel,
        reasons: ruleResult.reasons,
      })
    }

    const shouldCreateCase = ruleResult.riskScore >= this.rules.caseCreationThreshold
    const fraudCase = shouldCreateCase
      ? await this.createFraudCase({
          entityType,
          entityId,
          userId,
          riskScore: ruleResult.riskScore,
          riskLevel: ruleResult.riskLevel,
          reasons: ruleResult.reasons,
          metadata: { signals },
        })
      : null

    return {
      ...ruleResult,
      case: fraudCase,
      blocked: false,
    }
  }

  private lowRisk(): FraudEvaluationResult {
    return {
      riskScore: 0,
      riskLevel: 'low',
      reasons: [],
      case: null,
      blocked: false,
    }
  }

  private assertAdmin(actor: FraudActor): void {
    if (actor.role !== 'ADMIN') {
      throw new FraudServiceError('Fraud cases require admin access', 403, 'FRAUD_FORBIDDEN')
    }
  }

  private normalizeListQuery(input: FraudCaseListQuery) {
    const page = Number(input.page ?? DEFAULT_PAGE)
    const requestedLimit = Number(input.limit ?? DEFAULT_LIMIT)
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(requestedLimit) || requestedLimit < 1) {
      throw new FraudServiceError('Invalid fraud case pagination', 400, 'INVALID_FRAUD_STATUS')
    }

    return {
      page,
      limit: Math.min(requestedLimit, MAX_LIMIT),
      ...(input.status ? { status: this.parseStatus(input.status) } : {}),
      ...(input.riskLevel ? { riskLevel: this.parseRiskLevel(input.riskLevel) } : {}),
    }
  }

  private parseStatus(status: string): FraudCaseStatus {
    if (['OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED'].includes(status)) return status as FraudCaseStatus
    throw new FraudServiceError('Invalid fraud case status', 400, 'INVALID_FRAUD_STATUS')
  }

  private parseResolveStatus(status: string): FraudCaseStatus {
    if (status === 'RESOLVED' || status === 'DISMISSED') return status
    throw new FraudServiceError('Fraud case can only resolve to RESOLVED or DISMISSED', 400, 'INVALID_FRAUD_STATUS')
  }

  private parseRiskLevel(riskLevel: string): FraudRiskLevel {
    if (['low', 'medium', 'high', 'critical'].includes(riskLevel)) return riskLevel as FraudRiskLevel
    throw new FraudServiceError('Invalid fraud risk level', 400, 'INVALID_FRAUD_STATUS')
  }

  private sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!metadata) return undefined
    return this.redact(metadata) as Record<string, unknown>
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item))
    if (!value || typeof value !== 'object') return value
    const output: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      output[key] = secretKeyPattern.test(key) ? '[REDACTED]' : this.redact(nestedValue)
    }
    return output
  }

  private async auditBestEffort(adminUserId: string, action: 'FRAUD_CASE_REVIEWED' | 'FRAUD_CASE_RESOLVED', fraudCase: FraudCase): Promise<void> {
    await this.auditLogService?.createAuditLogBestEffort({
      actorUserId: adminUserId,
      actorRole: 'ADMIN',
      action,
      entityType: 'FraudCase',
      entityId: fraudCase.id,
      after: {
        status: fraudCase.status,
        riskScore: fraudCase.riskScore,
        riskLevel: fraudCase.riskLevel,
      },
      metadata: {
        entityType: fraudCase.entityType,
        entityId: fraudCase.entityId,
      },
      nonCritical: true,
    })
  }

  private toResponse(fraudCase: FraudCase): FraudCaseResponse {
    return {
      id: fraudCase.id,
      entityType: fraudCase.entityType,
      entityId: fraudCase.entityId,
      userId: fraudCase.userId,
      riskScore: fraudCase.riskScore,
      riskLevel: fraudCase.riskLevel,
      reasons: fraudCase.reasons,
      status: fraudCase.status,
      reviewedBy: fraudCase.reviewedBy,
      reviewedAt: fraudCase.reviewedAt,
      createdAt: fraudCase.createdAt,
    }
  }
}
