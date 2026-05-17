export type FraudErrorCode =
  | 'FRAUD_CASE_NOT_FOUND'
  | 'FRAUD_FORBIDDEN'
  | 'INVALID_FRAUD_STATUS'
  | 'FRAUD_EVALUATION_FAILED'

export class FraudServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: FraudErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'FraudServiceError'
  }
}
