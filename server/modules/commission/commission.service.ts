import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { WalletServiceError } from '#server/modules/wallet/wallet.errors.ts'

const DEFAULT_COMMISSION_BPS = 1000

export interface CommissionCalculation {
  grossamount: number
  commissionamount: number
  netamount: number
  commissionBps: number
}

export class CommissionService {
  private logger: ILogger
  private commissionBps: number

  constructor(appContext: AppContext, commissionBps = Number(process.env['PLATFORM_COMMISSION_BPS'] ?? DEFAULT_COMMISSION_BPS)) {
    this.logger = appContext.logger
    this.commissionBps = commissionBps
  }

  calculate(grossamount: number): CommissionCalculation {
    this.logger.debug('CommissionService.calculate', { grossamount })
    if (!Number.isInteger(this.commissionBps) || this.commissionBps < 0 || this.commissionBps > 10000) {
      throw new WalletServiceError('Commission rule not found', 500, 'COMMISSION_RULE_NOT_FOUND')
    }
    if (!Number.isInteger(grossamount) || grossamount < 0) {
      throw new WalletServiceError('Gross amount must be a non-negative integer', 400, 'COMMISSION_RULE_NOT_FOUND')
    }
    const commissionamount = Math.floor((grossamount * this.commissionBps) / 10000)
    return {
      grossamount,
      commissionamount,
      netamount: grossamount - commissionamount,
      commissionBps: this.commissionBps,
    }
  }
}
