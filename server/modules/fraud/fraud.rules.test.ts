import { describe, expect, it } from 'vitest'
import { evaluateFraudRules, getFraudRuleConfigFromEnv, riskLevelForScore, type FraudSignalInput } from './fraud.rules.ts'

const config = getFraudRuleConfigFromEnv({})
const cases: Array<[string, FraudSignalInput, number, string[]]> = [
  ['IP below', { manyOrdersFromSameIp: 4 }, 0, []],
  ['IP equal', { manyOrdersFromSameIp: 5 }, 20, ['many_orders_from_same_ip']],
  ['IP above', { manyOrdersFromSameIp: 6 }, 20, ['many_orders_from_same_ip']],
  ['failed payments below', { failedPayments: 2 }, 0, []],
  ['failed payments equal', { failedPayments: 3 }, 45, ['many_failed_payments']],
  ['failed payments above', { failedPayments: 4 }, 45, ['many_failed_payments']],
  ['refund count below', { refundCount: 2, refundRate: 0.5 }, 0, []],
  ['refund count equal', { refundCount: 3, refundRate: 0.5 }, 75, ['high_refund_rate']],
  ['refund count above', { refundCount: 4, refundRate: 0.5 }, 75, ['high_refund_rate']],
  ['refund ratio below', { refundCount: 3, refundRate: 0.4999 }, 0, []],
  ['refund ratio above', { refundCount: 3, refundRate: 0.5001 }, 75, ['high_refund_rate']],
  ['coupon below', { repeatedCouponUse: 4 }, 0, []],
  ['coupon equal', { repeatedCouponUse: 5 }, 75, ['repeated_coupon_abuse']],
  ['coupon above', { repeatedCouponUse: 6 }, 75, ['repeated_coupon_abuse']],
  ['device below', { sameDeviceAccounts: 0 }, 0, []],
  ['device equal', { sameDeviceAccounts: 1 }, 0, []],
  ['device above', { sameDeviceAccounts: 2 }, 20, ['multiple_accounts_same_device']],
  ['self referral', { affiliateSelfReferral: true }, 80, ['affiliate_self_referral']],
  ['amount below', { orderamount: 99999n }, 0, []],
  ['amount equal', { orderamount: 100000n }, 20, ['abnormal_order_amount']],
  ['amount above', { orderamount: 100001n }, 20, ['abnormal_order_amount']],
  ['rapid below', { checkoutDurationSeconds: 59 }, 15, ['suspicious_rapid_checkout']],
  ['rapid equal', { checkoutDurationSeconds: 60 }, 15, ['suspicious_rapid_checkout']],
  ['rapid above', { checkoutDurationSeconds: 61 }, 0, []],
  ['rapid absent', {}, 0, []],
  ['rapid null', { checkoutDurationSeconds: null }, 0, []],
  ['cancellations below', { cancelledOrders: 2 }, 0, []],
  ['cancellations equal', { cancelledOrders: 3 }, 20, ['repeated_cancelled_orders']],
  ['cancellations above', { cancelledOrders: 4 }, 20, ['repeated_cancelled_orders']],
]

describe('fraud numerical rule boundaries', () => {
  it.each(cases)('%s returns literal signal score', (_, signals, riskScore, reasons) => {
    expect(evaluateFraudRules(signals, config)).toMatchObject({ riskScore, reasons })
  })

  it.each([[39, 'low'], [40, 'medium'], [69, 'medium'], [70, 'high'], [89, 'high'], [90, 'critical']] as const)('score %s has level %s', (score, level) => {
    expect(riskLevelForScore(score, config)).toBe(level)
  })

  it('caps combined signals at 100 and preserves all nine reasons', () => {
    expect(evaluateFraudRules({ manyOrdersFromSameIp: 5, failedPayments: 3, refundCount: 3, refundRate: 0.5, repeatedCouponUse: 5, sameDeviceAccounts: 2, affiliateSelfReferral: true, orderamount: 100000n, checkoutDurationSeconds: 60, cancelledOrders: 3 }, config)).toEqual({
      riskScore: 100, riskLevel: 'critical', reasons: [
        'many_orders_from_same_ip', 'many_failed_payments', 'high_refund_rate', 'repeated_coupon_abuse',
        'multiple_accounts_same_device', 'affiliate_self_referral', 'abnormal_order_amount', 'suspicious_rapid_checkout', 'repeated_cancelled_orders',
      ],
    })
  })

  it('uses supplied configuration through the rule mechanism', () => {
    const configured = getFraudRuleConfigFromEnv({ FRAUD_ABNORMAL_ORDER_AMOUNT_CENTS: '200000', FRAUD_RAPID_CHECKOUT_SECONDS: '30' })
    expect(evaluateFraudRules({ orderamount: 199999n, checkoutDurationSeconds: 31 }, configured)).toMatchObject({ riskScore: 0, reasons: [] })
    expect(evaluateFraudRules({ orderamount: 200000n, checkoutDurationSeconds: 30 }, configured)).toMatchObject({ riskScore: 35, reasons: ['abnormal_order_amount', 'suspicious_rapid_checkout'] })
  })
})
