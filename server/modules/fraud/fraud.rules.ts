import type { FraudRiskLevel } from '#generated/client/enums.ts'

export interface FraudRuleConfig {
  caseCreationThreshold: number
  criticalThreshold: number
  mediumThreshold: number
  manyOrdersSameIpThreshold: number
  manyFailedPaymentsThreshold: number
  highRefundRateThreshold: number
  highRefundCountThreshold: number
  repeatedCouponUseThreshold: number
  abnormalOrderAmountCents: number
  rapidCheckoutSeconds: number
  repeatedCancelledOrdersThreshold: number
}

export interface FraudSignalInput {
  manyOrdersFromSameIp?: number
  failedPayments?: number
  refundRate?: number
  refundCount?: number
  repeatedCouponUse?: number
  sameDeviceAccounts?: number
  affiliateSelfReferral?: boolean
  orderAmountCents?: number
  checkoutDurationSeconds?: number | null
  cancelledOrders?: number
}

export interface FraudRuleResult {
  riskScore: number
  riskLevel: FraudRiskLevel
  reasons: string[]
}

export function getFraudRuleConfigFromEnv(env: Record<string, string | undefined> = process.env): FraudRuleConfig {
  return {
    caseCreationThreshold: parsePositiveInteger(env['FRAUD_CASE_THRESHOLD'], 70),
    criticalThreshold: parsePositiveInteger(env['FRAUD_CRITICAL_THRESHOLD'], 90),
    mediumThreshold: parsePositiveInteger(env['FRAUD_MEDIUM_THRESHOLD'], 40),
    manyOrdersSameIpThreshold: parsePositiveInteger(env['FRAUD_MANY_ORDERS_SAME_IP_THRESHOLD'], 5),
    manyFailedPaymentsThreshold: parsePositiveInteger(env['FRAUD_FAILED_PAYMENTS_THRESHOLD'], 3),
    highRefundRateThreshold: parseRate(env['FRAUD_HIGH_REFUND_RATE_THRESHOLD'], 0.5),
    highRefundCountThreshold: parsePositiveInteger(env['FRAUD_HIGH_REFUND_COUNT_THRESHOLD'], 3),
    repeatedCouponUseThreshold: parsePositiveInteger(env['FRAUD_COUPON_USE_THRESHOLD'], 5),
    abnormalOrderAmountCents: parsePositiveInteger(env['FRAUD_ABNORMAL_ORDER_AMOUNT_CENTS'], 100_000),
    rapidCheckoutSeconds: parsePositiveInteger(env['FRAUD_RAPID_CHECKOUT_SECONDS'], 60),
    repeatedCancelledOrdersThreshold: parsePositiveInteger(env['FRAUD_CANCELLED_ORDERS_THRESHOLD'], 3),
  }
}

export function evaluateFraudRules(signals: FraudSignalInput, config: FraudRuleConfig): FraudRuleResult {
  let riskScore = 0
  const reasons: string[] = []

  if ((signals.manyOrdersFromSameIp ?? 0) >= config.manyOrdersSameIpThreshold) {
    riskScore += 20
    reasons.push('many_orders_from_same_ip')
  }
  if ((signals.failedPayments ?? 0) >= config.manyFailedPaymentsThreshold) {
    riskScore += 45
    reasons.push('many_failed_payments')
  }
  if ((signals.refundCount ?? 0) >= config.highRefundCountThreshold && (signals.refundRate ?? 0) >= config.highRefundRateThreshold) {
    riskScore += 75
    reasons.push('high_refund_rate')
  }
  if ((signals.repeatedCouponUse ?? 0) >= config.repeatedCouponUseThreshold) {
    riskScore += 75
    reasons.push('repeated_coupon_abuse')
  }
  if ((signals.sameDeviceAccounts ?? 0) > 1) {
    riskScore += 20
    reasons.push('multiple_accounts_same_device')
  }
  if (signals.affiliateSelfReferral) {
    riskScore += 80
    reasons.push('affiliate_self_referral')
  }
  if ((signals.orderAmountCents ?? 0) >= config.abnormalOrderAmountCents) {
    riskScore += 20
    reasons.push('abnormal_order_amount')
  }
  if (signals.checkoutDurationSeconds !== null && signals.checkoutDurationSeconds !== undefined && signals.checkoutDurationSeconds <= config.rapidCheckoutSeconds) {
    riskScore += 15
    reasons.push('suspicious_rapid_checkout')
  }
  if ((signals.cancelledOrders ?? 0) >= config.repeatedCancelledOrdersThreshold) {
    riskScore += 20
    reasons.push('repeated_cancelled_orders')
  }

  const cappedScore = Math.min(100, riskScore)
  return {
    riskScore: cappedScore,
    riskLevel: riskLevelForScore(cappedScore, config),
    reasons,
  }
}

export function riskLevelForScore(score: number, config: FraudRuleConfig): FraudRiskLevel {
  if (score >= config.criticalThreshold) return 'critical'
  if (score >= config.caseCreationThreshold) return 'high'
  if (score >= config.mediumThreshold) return 'medium'
  return 'low'
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseRate(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback
}
