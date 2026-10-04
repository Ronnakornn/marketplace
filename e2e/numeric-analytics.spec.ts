import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { prisma } from '#server/lib/prisma.ts'
import en from '../messages/en.json' with { type: 'json' }
import { commerceFixture, loginUi } from './helpers/commerce-fixtures'
import { isolateActorPage } from './helpers/browser-context'

test.use({ storageState: { cookies: [], origins: [] } })
test.setTimeout(120_000)
test.beforeEach(async ({ page }) => { await isolateActorPage(page) })
test.afterAll(async () => { await prisma.$disconnect() })

test('paid analytics reconciles ten views to ten percent and revenue ranking across pages', async ({ page }, testInfo) => {
  const f = await commerceFixture()
  const shop = f.shops[0]!
  const now = new Date()
  await prisma.product.update({ where: { id: shop.product.id }, data: { title: `Numeric A ${shop.product.id}`, createdAt: now } })
  await prisma.productVariant.update({ where: { id: shop.variant.id }, data: { price: 100 } })
  const b = await prisma.product.create({ data: {
    shopId: shop.shop.id, sellerProfileId: shop.shop.sellerProfileId, categoryId: shop.product.categoryId,
    title: `Numeric B ${randomUUID()}`, slug: randomUUID(), status: 'ACTIVE', createdAt: new Date(now.getTime() - 1000),
    variants: { create: { sku: randomUUID(), title: 'B', price: 200, currency: 'THB', status: 'ACTIVE' } },
  }, include: { variants: true } })
  const c = await prisma.product.create({ data: {
    shopId: shop.shop.id, sellerProfileId: shop.shop.sellerProfileId, categoryId: shop.product.categoryId,
    title: `Numeric C ${randomUUID()}`, slug: randomUUID(), status: 'ACTIVE', createdAt: new Date(now.getTime() - 2000),
    variants: { create: { sku: randomUUID(), title: 'C', price: 900, currency: 'THB', status: 'ACTIVE' } },
  }, include: { variants: true } })
  const a = await prisma.product.findUniqueOrThrow({ where: { id: shop.product.id } })
  const cart = await prisma.cart.create({ data: { userId: f.buyer.id, status: 'CHECKED_OUT' } })
  const checkout = await prisma.checkout.create({ data: {
    cartId: cart.id, userId: f.buyer.id, status: 'COMPLETED', subtotal: 1200, grandTotal: 1200,
    expiresAt: new Date(now.getTime() + 900_000),
  } })
  const order = await prisma.order.create({ data: {
    checkoutId: checkout.id, userId: f.buyer.id, orderNumber: `NUMERIC-${randomUUID()}`, status: 'PAID', paymentStatus: 'SUCCEEDED',
    subtotal: 1200, grandTotal: 1200, shippingName: f.address.recipientName, shippingLine1: f.address.line1,
    shippingCity: f.address.city, shippingPostalCode: f.address.postalCode, shippingCountry: f.address.country,
    items: { create: [
      { shopId: shop.shop.id, variantId: shop.variant.id, productTitle: a.title, productSlug: a.slug, variantTitle: shop.variant.title, variantSku: shop.variant.sku, shopName: shop.shop.name, shopSlug: shop.shop.slug, quantity: 1, unitPrice: 100, lineTotal: 100 },
      { shopId: shop.shop.id, variantId: b.variants[0]!.id, productTitle: b.title, productSlug: b.slug, variantTitle: 'B', variantSku: b.variants[0]!.sku, shopName: shop.shop.name, shopSlug: shop.shop.slug, quantity: 1, unitPrice: 200, lineTotal: 200 },
      { shopId: shop.shop.id, variantId: c.variants[0]!.id, productTitle: c.title, productSlug: c.slug, variantTitle: 'C', variantSku: c.variants[0]!.sku, shopName: shop.shop.name, shopSlug: shop.shop.slug, quantity: 1, unitPrice: 900, lineTotal: 900 },
    ] },
  } })
  await prisma.shopOrder.create({ data: { orderId: order.id, shopId: shop.shop.id, status: 'PAID', subtotal: 1200, grandTotal: 1200 } })
  await prisma.payment.create({ data: { orderId: order.id, provider: 'mock', providerIntentId: randomUUID(), status: 'SUCCEEDED', amount: 1200, currency: 'THB', paidAt: now } })
  await prisma.productViewLog.createMany({ data: Array.from({ length: 10 }, () => ({ productId: a.id, shopId: shop.shop.id, userId: f.buyer.id, createdAt: now })) })

  await loginUi(page, shop.seller, `/en/seller/analytics/products?shopId=${shop.shop.id}`)
  await expect(page.getByRole('heading', { name: en.seller.analytics.title, exact: true })).toBeVisible()
  const aRow = page.getByRole('row').filter({ hasText: a.title })
  await expect(aRow.getByRole('cell', { name: '10%', exact: true })).toBeVisible()
  await expect(page.getByText('10%', { exact: true })).toHaveCount(2)
  const rows = page.getByRole('table').getByRole('row')
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(1)).toContainText(c.title)
  await expect(rows.nth(1)).toContainText(/9\.00/)
  await expect(rows.nth(2)).toContainText(b.title)
  await expect(rows.nth(3)).toContainText(a.title)

  const summaryResponse = await page.request.get('/api/seller/analytics/products/summary?range=30d')
  expect(summaryResponse.ok(), await summaryResponse.text()).toBeTruthy()
  expect(await summaryResponse.json()).toMatchObject({ views: 10, orders: 1, unitsSold: 3, revenue: '1200', conversionRate: 0.1 })
  const firstResponse = await page.request.get('/api/seller/analytics/products?range=30d&sort=revenue&page=1&limit=2')
  expect(firstResponse.ok(), await firstResponse.text()).toBeTruthy()
  const first = await firstResponse.json()
  expect(first.items).toHaveLength(2)
  expect(first.items).toMatchObject([{ productId: c.id, revenue: '900' }, { productId: b.id, revenue: '200' }])
  expect(first.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 })
  const secondResponse = await page.request.get('/api/seller/analytics/products?range=30d&sort=revenue&page=2&limit=2')
  expect(secondResponse.ok(), await secondResponse.text()).toBeTruthy()
  const second = await secondResponse.json()
  expect(second.items).toHaveLength(1)
  expect(second.items).toMatchObject([{ productId: a.id, revenue: '100', conversionRate: 0.1 }])
  const paidOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } })
  expect(paidOrder.grandTotal).toBe(1200n)
  expect(paidOrder.items.map((item) => item.lineTotal).sort((left, right) => left < right ? -1 : left > right ? 1 : 0)).toEqual([100n, 200n, 900n])
  expect(await prisma.productViewLog.count({ where: { productId: a.id } })).toBe(10)
  const screenshotPath = testInfo.outputPath('numeric-analytics.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  await testInfo.attach('numeric-analytics', { path: screenshotPath, contentType: 'image/png' })
})
