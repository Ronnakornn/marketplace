export type RecommendationErrorCode =
  | 'PRODUCT_NOT_FOUND'
  | 'INVALID_RECOMMENDATION_QUERY'

export class RecommendationServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: RecommendationErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'RecommendationServiceError'
  }
}
