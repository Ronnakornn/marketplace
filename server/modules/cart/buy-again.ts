import type { HistoricalCartItem } from './cart.repository.ts'

export type BuyAgainSkipReason =
  | 'VARIANT_NOT_FOUND'
  | 'VARIANT_UNAVAILABLE'
  | 'PRODUCT_UNAVAILABLE'
  | 'SHOP_UNAVAILABLE'
  | 'PRICE_UNAVAILABLE'
  | 'CURRENCY_UNSUPPORTED'
  | 'OUT_OF_STOCK'
  | 'EXISTING_QUANTITY_EXCEEDS_STOCK'

type BuyAgainItemQuantities = Omit<HistoricalCartItem, 'quantity'> & {
  requestedQuantity: number
  existingQuantity: number
  targetQuantity: number
  addedQuantity: number
  finalQuantity: number
  availableQuantity: number
}

export type BuyAgainItemOutcome = BuyAgainItemQuantities & (
  | { kind: 'added' | 'already_in_cart'; reason: null; unitPrice: bigint; currency: string }
  | { kind: 'partial'; reason: 'STOCK_LIMIT'; unitPrice: bigint; currency: string }
  | { kind: 'skipped'; reason: BuyAgainSkipReason; unitPrice: bigint | null; currency: string | null }
)

export type BuyAgainResult = { cartId: string; items: BuyAgainItemOutcome[] }
