import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { CommissionService } from '#server/modules/commission'
import type { IWalletRepository, WalletRecord } from './wallet.repository.ts'
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
    currency: 'USD',
    version: 0,
    balance: BigInt(0),
    pendingBalance: BigInt(0),
    withdrawableBalance: BigInt(0),
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    shop: { id: 'shop-1', name: 'Shop One', ownerId },
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
    createLedgerEntry: vi.fn(),
    findCompletedOrder: vi.fn(),
    hasOrderEarnings: vi.fn(),
  }
}

let repo: IWalletRepository
let service: WalletService

describe('WalletService', () => {
  beforeEach(() => {
    repo = repoMock()
    service = new WalletService(appContext(), repo, new CommissionService(appContext(), 1000))
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1', name: 'Shop One', ownerId: 'seller-1' }])
    vi.mocked(repo.ensureWallet).mockResolvedValue(walletRecord())
    vi.mocked(repo.findWalletByShopId).mockResolvedValue(walletRecord())
    vi.mocked(repo.sumLedger).mockResolvedValue(9000)
  })

  it('seller wallet summary works', async () => {
    await expect(service.getSellerWallet({ id: 'seller-1', role: 'USER' })).resolves.toEqual({
      walletId: 'wallet-1',
      shopId: 'shop-1',
      shopName: 'Shop One',
      currency: 'USD',
      availableBalanceCents: 9000,
    })
  })

  it('seller cannot see another wallet', async () => {
    vi.mocked(repo.findWalletByShopId).mockResolvedValue(walletRecord('seller-2'))

    await expect(service.getSellerWallet({ id: 'seller-1', role: 'USER' })).rejects.toMatchObject({
      code: 'WALLET_FORBIDDEN',
    })
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
      currency: 'USD',
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
        currency: 'USD',
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
