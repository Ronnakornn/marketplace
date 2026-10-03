import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient, type Prisma } from '#generated/client/client.ts'
import { CommissionService } from '#server/modules/commission'
import { PrismaWalletRepository } from './wallet.repository.ts'
import { WalletService } from './wallet.service.ts'

const url = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!url)('completed-order earnings on PostgreSQL', () => {
  let prisma: PrismaClient
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a local disposable marketplace_test_* database')
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
  })
  afterAll(async () => { await prisma?.$disconnect() })

  it('credits each shop once when completed-order callbacks overlap and replay', async () => {
    const tag = randomUUID()
    const user = await prisma.user.create({ data: { name: 'Wallet numeric test', email: `${tag}@example.test` } })
    const sellerProfile = await prisma.sellerProfile.create({ data: { userId: user.id } })
    const cart = await prisma.cart.create({ data: { userId: user.id } })
    const checkout = await prisma.checkout.create({ data: { cartId: cart.id, userId: user.id, expiresAt: new Date(Date.now() + 60000) } })
    const items: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] = []
    for (const amount of [10001, 20002]) {
      const shopTag = randomUUID()
      const shop = await prisma.shop.create({ data: { ownerId: user.id, sellerProfileId: sellerProfile.id, name: 'Wallet test shop', slug: shopTag, contactEmail: user.email, contactPhone: '0800000000', status: 'ACTIVE' } })
      await prisma.shopWallet.create({ data: { shopId: shop.id } })
      const product = await prisma.product.create({ data: { shopId: shop.id, title: 'Wallet test item', slug: shopTag, status: 'ACTIVE' } })
      const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: shopTag, title: 'Default', price: amount } })
      items.push({ shopId: shop.id, variantId: variant.id, productTitle: product.title, productSlug: product.slug,
        variantTitle: variant.title, variantSku: variant.sku, shopName: shop.name, shopSlug: shop.slug,
        quantity: 1, unitPrice: amount, lineTotal: amount, fulfillmentStatus: 'DELIVERED' as const })
    }
    const order = await prisma.order.create({ data: {
      checkoutId: checkout.id, userId: user.id, orderNumber: tag, status: 'DELIVERED', paymentStatus: 'SUCCEEDED',
      subtotal: 30003, grandTotal: 30003, shippingName: 'Buyer', shippingLine1: '1 Road', shippingCity: 'Bangkok',
      shippingPostalCode: '10110', shippingCountry: 'TH', items: { create: items },
    } })
    const service = new WalletService(context, new PrismaWalletRepository(context, prisma), new CommissionService(context, 1000))
    const original = PrismaWalletRepository.prototype.hasOrderEarnings
    const delayedRead = vi.spyOn(PrismaWalletRepository.prototype, 'hasOrderEarnings').mockImplementation(async function (this: PrismaWalletRepository, orderId, shopId) {
      const exists = await original.call(this, orderId, shopId)
      await setTimeout(30)
      return exists
    })
    try {
      await Promise.all([service.createEarningsForCompletedOrder(order.id), service.createEarningsForCompletedOrder(order.id)])
      await service.createEarningsForCompletedOrder(order.id)
    } finally {
      delayedRead.mockRestore()
    }
    const entries = await prisma.walletLedgerEntry.findMany({ where: { orderId: order.id } })
    expect(entries.filter((entry) => entry.type === 'order_earning')).toHaveLength(2)
    expect(entries.filter((entry) => entry.type === 'commission_fee')).toHaveLength(2)
    const firstShop = entries.filter((entry) => entry.shopId === items[0]!.shopId)
    const secondShop = entries.filter((entry) => entry.shopId === items[1]!.shopId)
    expect(firstShop.map((entry) => entry.amount).sort((a, b) => Number(a - b))).toEqual([-1000n, 10001n])
    expect(secondShop.map((entry) => entry.amount).sort((a, b) => Number(a - b))).toEqual([-2000n, 20002n])
    expect(firstShop.reduce((sum, entry) => sum + entry.amount, 0n)).toBe(9001n)
    expect(secondShop.reduce((sum, entry) => sum + entry.amount, 0n)).toBe(18002n)
  })
})
