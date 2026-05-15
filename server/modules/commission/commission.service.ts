import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { WalletServiceError } from '#server/modules/wallet/wallet.errors.ts'

const DEFAULT_COMMISSION_BPS = 1000

export interface CommissionCalculation {
  grossAmountCents: number
  commissionAmountCents: number
  netAmountCents: number
  commissionBps: number
}

export class CommissionService {
  private logger: ILogger
  private commissionBps: number

  constructor(appContext: AppContext, commissionBps = Number(process.env['PLATFORM_COMMISSION_BPS'] ?? DEFAULT_COMMISSION_BPS)) {
    this.logger = appContext.logger
    this.commissionBps = commissionBps
  }

  calculate(grossAmountCents: number): CommissionCalculation {
    this.logger.debug('CommissionService.calculate', { grossAmountCents })
    if (!Number.isInteger(this.commissionBps) || this.commissionBps < 0 || this.commissionBps > 10000) {
      throw new WalletServiceError('Commission rule not found', 500, 'COMMISSION_RULE_NOT_FOUND')
    }
    if (!Number.isInteger(grossAmountCents) || grossAmountCents < 0) {
      throw new WalletServiceError('Gross amount must be a non-negative integer', 400, 'COMMISSION_RULE_NOT_FOUND')
    }
    const commissionAmountCents = Math.floor((grossAmountCents * this.commissionBps) / 10000)
    return {
      grossAmountCents,
      commissionAmountCents,
      netAmountCents: grossAmountCents - commissionAmountCents,
      commissionBps: this.commissionBps,
    }
  }
}
