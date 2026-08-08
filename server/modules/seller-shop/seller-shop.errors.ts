export type SellerShopErrorCode =
  | 'SHOP_FORBIDDEN'
  | 'SELLER_PROFILE_NOT_FOUND'
  | 'SELLER_SHOP_NOT_ACTIVE'
  | 'SHOP_SLUG_EXISTS'
  | 'SHOP_PROFILE_INVALID'
  | 'SHOP_SETTINGS_INVALID'
  | 'SHOP_NOT_FOUND'

export class SellerShopServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: SellerShopErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'SellerShopServiceError'
  }
}
