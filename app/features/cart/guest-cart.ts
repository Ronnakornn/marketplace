const KEY = 'marketplace:guest-cart'
export const GUEST_CART_CHANGED_EVENT = 'marketplace:guest-cart-changed'
export type GuestCartItem = {
  variantId: string
  quantity: number
  productId?: string
  title?: string
  variantTitle?: string
  imageUrl?: string | null
  unitPrice?: number
  currency?: string
}
export type GuestCartItemSnapshot = Omit<GuestCartItem, 'variantId' | 'quantity'>

export function readGuestCart(): GuestCartItem[] {
  if (typeof window === 'undefined') return []
  try { const data = JSON.parse(window.localStorage.getItem(KEY) ?? '[]'); return Array.isArray(data) ? data.filter((item): item is GuestCartItem => typeof item?.variantId === 'string' && Number.isInteger(item?.quantity) && item.quantity > 0) : [] } catch { return [] }
}
export function addGuestCartItem(variantId: string, quantity: number, snapshot?: GuestCartItemSnapshot) {
  const items = readGuestCart(); const existing = items.find((item) => item.variantId === variantId)
  if (existing) { existing.quantity += quantity; Object.assign(existing, snapshot) } else items.push({ variantId, quantity, ...snapshot })
  window.localStorage.setItem(KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(GUEST_CART_CHANGED_EVENT))
}
export function writeGuestCart(items: GuestCartItem[]) { if (typeof window !== 'undefined') { window.localStorage.setItem(KEY, JSON.stringify(items)); window.dispatchEvent(new Event(GUEST_CART_CHANGED_EVENT)) } }
export function clearGuestCart() { if (typeof window !== 'undefined') { window.localStorage.removeItem(KEY); window.dispatchEvent(new Event(GUEST_CART_CHANGED_EVENT)) } }
