import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { CommissionService } from '#server/modules/commission'
import type { CompletedOrderRecord, IWalletRepository, WalletRecord } from './wallet.repository.ts'
import { WalletService } from './wallet.service.ts'

function appContext(): AppContext {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    config: { environment: 'test' },
  }
}

function walletRecord(ownerId = 'seller-1'): WalletRecord {
  return {
    id: 'wallet-1',
    shopId: 'shop-1',
    currency: 'THB',
    version: 0,
    balance: BigInt(0),
    pendingBalance: BigInt(0),
    withdrawableBalance: BigInt(0),
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    shop: { id: 'shop-1', name: 'Shop One', ownerId },
  }
}

function snapshottedOrder(): CompletedOrderRecord {
  const now = new Date('2026-10-04T00:00:00Z')
  return {
    id: 'order-1', checkoutId: 'checkout-1', userId: 'buyer-1', orderNumber: 'ORD-1', status: 'DELIVERED', paymentStatus: 'SUCCEEDED',
    subtotal: 100000n, discountTotal: 12000n, shippingTotal: 4000n, taxTotal: 0n, grandTotal: 92000n, currency: 'THB',
    shippingName: 'Buyer', shippingPhone: null, shippingLine1: '1 Road', shippingLine2: null, shippingCity: 'Bangkok',
    shippingRegion: null, shippingPostalCode: '10110', shippingCountry: 'TH', createdAt: now, updatedAt: now,
    items: [{
      id: 'item-1', orderId: 'order-1', shopId: 'shop-1', variantId: 'variant-1', productTitle: 'Item', productSlug: 'item',
      variantTitle: 'Default', variantSku: 'SKU', shopName: 'Shop', shopSlug: 'shop', quantity: 1,
      unitPrice: 100000n, lineTotal: 100000n, currency: 'THB', fulfillmentStatus: 'DELIVERED',
      saleSnapshot: {
        orderItemId: 'item-1', shopOrderId: 'shop-order-1', originalQuantity: 1, grossMerchandise: 100000n,
        sellerCouponDiscount: 10000n, platformCouponDiscount: 0n, coinDiscount: 2000n, buyerMerchandise: 88000n,
        couponId: 'coupon-1', couponCode: 'TEN_OFF', refundAllocations: [],
      },
    }],
    shopOrders: [{
      id: 'shop-order-1', orderId: 'order-1', shopId: 'shop-1', status: 'DELIVERED', fulfillmentStatus: 'DELIVERED',
      subtotal: 100000n, discountTotal: 12000n, shippingTotal: 4000n, taxTotal: 0n, grandTotal: 92000n,
      currency: 'THB', version: 1, createdAt: now, updatedAt: now,
      saleSnapshot: {
        shopOrderId: 'shop-order-1', policyVersion: 1, currency: 'THB', commissionBase: 90000n, commissionBps: 1000,
        originalCommission: 9000n, originalShipping: 4000n, buyerShipping: 4000n, sellerShippingWaiver: 0n,
        platformShippingSubsidy: 0n, recognizedAt: null, refundAllocations: [],
      },
    }],
  }
}

function repoMock(): IWalletRepository {
  return {
    transaction: vi.fn((callback) => callback(repo)),
    findSellerShops: vi.fn(),
    findWalletByShopId: vi.fn(),
    ensureWallet: vi.fn(),
    listEntries: vi.fn(),
    sumLedger: vi.fn(),
    sumReservedPayouts: vi.fn(),
    createLedgerEntry: vi.fn(),
    lockOrder: vi.fn(),
    findCompletedOrder: vi.fn(),
    hasOrderEarnings: vi.fn(),
    lockWallet: vi.fn(),
    recognizeShopSale: vi.fn(),
  }
}

let repo: IWalletRepository
let service: WalletService

describe('WalletService', () => {
  it.each([9007199254740992, 1.5, Number.POSITIVE_INFINITY])('rejects unsafe refund amount %s before a transaction or write', async (amount) => {
    await expect(service.applyRefundAdjustment('shop-1', 'refund-1', 'order-1', amount)).rejects.toMatchObject({ status: 400 })
    expect(repo.transaction).not.toHaveBeenCalled()
    expect(repo.createLedgerEntry).not.toHaveBeenCalled()
  })
  beforeEach(() => {
    repo = repoMock()
    service = new WalletService(appContext(), repo, new CommissionService(appContext(), 1000))
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1', name: 'Shop One', ownerId: 'seller-1' }])
    vi.mocked(repo.ensureWallet).mockResolvedValue(walletRecord())
    vi.mocked(repo.findWalletByShopId).mockResolvedValue(walletRecord())
    vi.mocked(repo.sumLedger).mockResolvedValue(9000n)
    vi.mocked(repo.sumReservedPayouts).mockResolvedValue(0n)
  })

  it('seller wallet summary works', async () => {
    await expect(service.getSellerWallet({ id: 'seller-1', role: 'USER' })).resolves.toEqual({
      walletId: 'wallet-1',
      shopId: 'shop-1',
      shopName: 'Shop One',
      currency: 'THB',
      availableBalanceCents: 9000n,
      sellerDebtCents: 0n,
    })
  })

  it('seller cannot see another wallet', async () => {
    vi.mocked(repo.findWalletByShopId).mockResolvedValue(walletRecord('seller-2'))

    await expect(service.getSellerWallet({ id: 'seller-1', role: 'USER' })).rejects.toMatchObject({
      code: 'WALLET_FORBIDDEN',
    })
  })

  it('distinguishes an unpaid payout reservation from seller debt', async () => {
    vi.mocked(repo.sumLedger).mockResolvedValue(-100n)
    vi.mocked(repo.sumReservedPayouts).mockResolvedValue(100n)
    await expect(service.getSellerWallet({ id: 'seller-1', role: 'USER' })).resolves.toMatchObject({ availableBalanceCents: -100n, sellerDebtCents: 0n })
    vi.mocked(repo.sumReservedPayouts).mockResolvedValue(0n)
    await expect(service.getSellerWallet({ id: 'seller-1', role: 'USER' })).resolves.toMatchObject({ availableBalanceCents: -100n, sellerDebtCents: 100n })
  })

  it('uses seller-funded net merchandise, shipping and the original commission after the live rate changes', async () => {
    vi.mocked(repo.findCompletedOrder).mockResolvedValue(snapshottedOrder())
    service = new WalletService(appContext(), repo, new CommissionService(appContext(), 2000))
    await service.createEarningsForCompletedOrder('order-1')
    expect(vi.mocked(repo.createLedgerEntry).mock.calls.map(([entry]) => [entry.type, entry.amount])).toEqual([
      ['order_earning', 94000], ['commission_fee', -9000],
    ])
    expect(repo.recognizeShopSale).toHaveBeenCalledWith('shop-order-1', expect.any(Date))
  })

  it('recognizes only retained shipping after a successful merchandise refund before earnings', async () => {
    const order = snapshottedOrder()
    const itemSale = order.items[0].saleSnapshot
    const shopSale = order.shopOrders?.[0].saleSnapshot
    if (!itemSale || !shopSale) throw new Error('Test snapshot missing')
    itemSale.refundAllocations = [{ id: 'item-refund', refundId: 'refund-1', orderItemId: 'item-1', quantity: 1,
      cashMerchandise: 88000n, platformCouponReversal: 0n, coinFundingReversal: 2000n, refund: { status: 'SUCCESS' } }]
    shopSale.refundAllocations = [{ id: 'shop-refund', refundId: 'refund-1', shopOrderId: 'shop-order-1',
      buyerShippingRefund: 0n, platformShippingReversal: 0n, commissionReversal: 9000n,
      shippingCause: 'CHANGE_OF_MIND', walletPostedAt: null, refund: { status: 'SUCCESS' } }]
    vi.mocked(repo.findCompletedOrder).mockResolvedValue(order)
    await service.createEarningsForCompletedOrder('order-1')
    expect(vi.mocked(repo.createLedgerEntry).mock.calls.map(([entry]) => [entry.type, entry.amount])).toEqual([['order_earning', 4000]])
    expect(repo.recognizeShopSale).toHaveBeenCalledWith('shop-order-1', expect.any(Date))
  })

  it.each([{ payer: 'platform', gross: 94000 }, { payer: 'seller', gross: 90000 }])('credits the shipping entitlement for $payer free shipping', async ({ payer, gross }) => {
    const order = snapshottedOrder()
    const shop = order.shopOrders?.[0]
    const sale = shop?.saleSnapshot
    if (!shop || !sale) throw new Error('Test snapshot missing')
    order.grandTotal = shop.grandTotal = 88000n
    order.shippingTotal = shop.shippingTotal = 0n
    sale.buyerShipping = 0n
    sale.platformShippingSubsidy = payer === 'platform' ? 4000n : 0n
    sale.sellerShippingWaiver = payer === 'seller' ? 4000n : 0n
    vi.mocked(repo.findCompletedOrder).mockResolvedValue(order)
    await service.createEarningsForCompletedOrder('order-1')
    expect(vi.mocked(repo.createLedgerEntry).mock.calls.map(([entry]) => [entry.type, entry.amount])).toEqual([
      ['order_earning', gross], ['commission_fee', -9000],
    ])
  })

  it('records zero earning recognition once when all merchandise and shipping were refunded', async () => {
    const order = snapshottedOrder()
    const itemSale = order.items[0].saleSnapshot
    const shopSale = order.shopOrders?.[0].saleSnapshot
    if (!itemSale || !shopSale) throw new Error('Test snapshot missing')
    itemSale.refundAllocations = [{ id: 'item-refund', refundId: 'refund-1', orderItemId: 'item-1', quantity: 1,
      cashMerchandise: 88000n, platformCouponReversal: 0n, coinFundingReversal: 2000n, refund: { status: 'SUCCESS' } }]
    shopSale.refundAllocations = [{ id: 'shop-refund', refundId: 'refund-1', shopOrderId: 'shop-order-1',
      buyerShippingRefund: 4000n, platformShippingReversal: 0n, commissionReversal: 9000n,
      shippingCause: 'SELLER_FAULT', walletPostedAt: null, refund: { status: 'SUCCESS' } }]
    vi.mocked(repo.findCompletedOrder).mockResolvedValue(order)
    vi.mocked(repo.recognizeShopSale).mockImplementation(async (_shopOrderId, at) => { shopSale.recognizedAt = at })
    await service.createEarningsForCompletedOrder('order-1')
    await service.createEarningsForCompletedOrder('order-1')
    expect(vi.mocked(repo.createLedgerEntry).mock.calls.map(([entry]) => [entry.type, entry.amount])).toEqual([['order_earning', 0]])
  })

  it('rejects a mixed legacy and snapshot order instead of partially crediting earnings', async () => {
    const order = snapshottedOrder()
    order.items[0].saleSnapshot = null
    vi.mocked(repo.findCompletedOrder).mockResolvedValue(order)
    await expect(service.createEarningsForCompletedOrder('order-1')).rejects.toMatchObject({ status: 409, code: 'INVALID_PAYOUT_STATE' })
    expect(repo.createLedgerEntry).not.toHaveBeenCalled()
  })

  it('completed order creates earning ledger and commission is deducted', async () => {
    vi.mocked(repo.findCompletedOrder).mockResolvedValue({
      id: 'order-1',
      checkoutId: 'checkout-1',
      userId: 'buyer-1',
      orderNumber: 'ORD-1',
      status: 'DELIVERED',
      paymentStatus: 'SUCCEEDED',
      subtotal: BigInt(10000),
      discountTotal: BigInt(0),
      shippingTotal: BigInt(0),
      taxTotal: BigInt(0),
      grandTotal: BigInt(10000),
      currency: 'THB',
      shippingName: 'Buyer',
      shippingPhone: null,
      shippingLine1: 'Line 1',
      shippingLine2: null,
      shippingCity: 'City',
      shippingRegion: null,
      shippingPostalCode: '10000',
      shippingCountry: 'US',
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [{
        id: 'item-1',
        orderId: 'order-1',
        shopId: 'shop-1',
        variantId: 'variant-1',
        productTitle: 'Item',
        productSlug: 'item',
        variantTitle: 'Default',
        variantSku: 'SKU',
        shopName: 'Shop One',
        shopSlug: 'shop-one',
        quantity: 1,
        unitPrice: BigInt(10000),
        lineTotal: BigInt(10000),
        currency: 'THB',
        fulfillmentStatus: 'DELIVERED',
      }],
    })
    vi.mocked(repo.hasOrderEarnings).mockResolvedValue(false)

    await service.createEarningsForCompletedOrder('order-1')

    expect(repo.createLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'order_earning',
      amount: 10000,
    }))
    expect(repo.createLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'commission_fee',
      amount: -1000,
    }))
  })

  it('refund adjustment reduces seller balance', async () => {
    await service.applyRefundAdjustment('shop-1', 'refund-1', 'order-1', 2500)

    expect(repo.createLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'refund_adjustment',
      amount: -2500,
      refundId: 'refund-1',
    }))
  })

  it('transaction rollback works', async () => {
    vi.mocked(repo.transaction).mockRejectedValue(new Error('rollback'))

    await expect(service.applyRefundAdjustment('shop-1', 'refund-1', 'order-1', 2500)).rejects.toThrow('rollback')
    expect(repo.createLedgerEntry).not.toHaveBeenCalled()
  })
})
