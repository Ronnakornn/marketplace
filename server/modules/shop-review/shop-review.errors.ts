export type ShopReviewErrorCode =
  | 'SHOP_NOT_FOUND'
  | 'SHOP_ORDER_NOT_FOUND'
  | 'SHOP_REVIEW_NOT_FOUND'
  | 'SHOP_REVIEW_ALREADY_EXISTS'
  | 'SHOP_REVIEW_FORBIDDEN'
  | 'SHOP_ORDER_NOT_DELIVERED'
  | 'INVALID_RATING'
  | 'INVALID_MODERATION_DECISION'
  | 'MODERATION_REASON_REQUIRED'
  | 'SHOP_REVIEW_QUERY_INVALID'

export class ShopReviewServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ShopReviewErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ShopReviewServiceError'
  }
}
