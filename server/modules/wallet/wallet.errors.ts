export type WalletErrorCode =
  | 'WALLET_NOT_FOUND'
  | 'WALLET_FORBIDDEN'
  | 'INSUFFICIENT_BALANCE'
  | 'PAYOUT_NOT_FOUND'
  | 'PAYOUT_FORBIDDEN'
  | 'INVALID_PAYOUT_STATE'
  | 'COMMISSION_RULE_NOT_FOUND'

export class WalletServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: WalletErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'WalletServiceError'
  }
}
