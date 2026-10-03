import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Order, type OrderStatus, type PaymentStatus, type Product, type ProductVariant } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'

export const thresholdContext: AppContext = {
  logger: { debug() {}, info() {}, warn() {}, error() {} },
  config: { environment: 'test' },
}

export function thresholdDatabase(): PrismaClient {
  const connectionString = process.env['COMMERCE_TEST_DATABASE_URL']
  if (!connectionString) throw new Error('COMMERCE_TEST_DATABASE_URL is required')
  const parsed = new URL(connectionString)
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_') || parsed.port !== '55439') {
    throw new Error('Use local marketplace_test_* on port55439')
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

export async function numericThresholdFixture(db: PrismaClient) {
  const tag = randomUUID()
  const owner = await db.user.create({ data: { name: 'Threshold seller', email: `${tag}-seller@example.test` } })
  const buyer = await db.user.create({ data: { name: 'Threshold buyer', email: `${tag}-buyer@example.test` } })
  const profile = await db.sellerProfile.create({ data: { userId: owner.id } })
  const shop = await db.shop.create({ data: { ownerId: owner.id, sellerProfileId: profile.id, name: tag, slug: tag, status: 'ACTIVE', contactEmail: owner.email, contactPhone: '0800000000' } })
  const category = await db.category.create({ data: { name: tag, slug: tag, isActive: true } })
  const brand = await db.brand.create({ data: { name: tag, slug: tag, isActive: true } })
  const product = await db.product.create({ data: { shopId: shop.id, categoryId: category.id, brandId: brand.id, title: tag, slug: tag, status: 'ACTIVE' } })
  const variant = await db.productVariant.create({ data: { productId: product.id, sku: tag, title: tag, price: 100n, status: 'ACTIVE', inventory: { create: { quantityOnHand: 3, quantityReserved: 2 } } } })
  return { tag, owner, buyer, shop, category, brand, product, variant }
}

export async function thresholdProduct(db: PrismaClient, fixture: Awaited<ReturnType<typeof numericThresholdFixture>>, input: {
  price: bigint; createdAt?: Date; status?: Product['status']; variantStatus?: ProductVariant['status'];
  onHand?: number; reserved?: number; categoryId?: string; shopId?: string;
}) {
  const tag = randomUUID()
  const product = await db.product.create({ data: { shopId: input.shopId ?? fixture.shop.id, categoryId: input.categoryId ?? fixture.category.id, brandId: fixture.brand.id, title: tag, slug: tag, status: input.status ?? 'ACTIVE', ...(input.createdAt ? { createdAt: input.createdAt } : {}) } })
  const variant = await db.productVariant.create({ data: { productId: product.id, sku: tag, title: tag, price: input.price, status: input.variantStatus ?? 'ACTIVE', inventory: { create: { quantityOnHand: input.onHand ?? 3, quantityReserved: input.reserved ?? 2 } } } })
  return { product, variant }
}

export async function thresholdSale(db: PrismaClient, fixture: Awaited<ReturnType<typeof numericThresholdFixture>>, input: {
  product?: Product; variant?: ProductVariant; quantity?: number; amount?: bigint;
  createdAt?: Date; checkoutCreatedAt?: Date; status?: OrderStatus; paymentStatus?: Order['paymentStatus']; paymentState?: PaymentStatus;
} = {}) {
  const product = input.product ?? fixture.product
  const variant = input.variant ?? fixture.variant
  const quantity = input.quantity ?? 1
  const amount = input.amount ?? BigInt(quantity) * 100n
  if (amount % BigInt(quantity) !== 0n) throw new Error('Threshold fixture requires whole minor-unit price')
  const createdAt = input.createdAt ?? new Date('2026-10-04T00:00:00.000Z')
  const cart = await db.cart.create({ data: { userId: fixture.buyer.id, status: 'CHECKED_OUT' } })
  const checkout = await db.checkout.create({ data: { cartId: cart.id, userId: fixture.buyer.id, subtotal: amount, grandTotal: amount, status: 'COMPLETED', expiresAt: createdAt, createdAt: input.checkoutCreatedAt ?? new Date('2026-10-03T23:00:00.000Z') } })
  const order = await db.order.create({ data: {
    checkoutId: checkout.id, userId: fixture.buyer.id, orderNumber: randomUUID(), status: input.status ?? 'PAID', paymentStatus: input.paymentStatus ?? 'SUCCEEDED', subtotal: amount, grandTotal: amount, createdAt,
    shippingName: 'Threshold buyer', shippingLine1: '1 Test Road', shippingCity: 'Bangkok', shippingPostalCode: '10110', shippingCountry: 'TH',
  } })
  const payment = await db.payment.create({ data: { orderId: order.id, provider: 'mock', providerIntentId: randomUUID(), status: input.paymentState ?? 'SUCCEEDED', amount, currency: 'THB' } })
  const shopOrder = await db.shopOrder.create({ data: { orderId: order.id, shopId: fixture.shop.id, status: input.status ?? 'PAID', subtotal: amount, grandTotal: amount } })
  const item = await db.orderItem.create({ data: { orderId: order.id, shopId: fixture.shop.id, variantId: variant.id, quantity, unitPrice: amount / BigInt(quantity), lineTotal: amount, fulfillmentStatus: 'DELIVERED', productTitle: product.title, productSlug: product.slug, variantTitle: variant.title, variantSku: variant.sku, shopName: fixture.shop.name, shopSlug: fixture.shop.slug } })
  return { cart, checkout, order, payment, shopOrder, item }
}
