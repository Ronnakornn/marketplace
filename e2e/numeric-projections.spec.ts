import { randomUUID } from 'node:crypto'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import type { Product, ProductVariant } from '#generated/client/client.ts'
import { prisma } from '#server/lib/prisma.ts'
import type { MoneyDto } from '#server/lib/money.ts'
import type { ProductSearchItem } from '#server/modules/search/search.service.ts'
import type { RecommendationProductCard } from '#server/modules/recommendation/recommendation.service.ts'
import type { CatalogProductListItem } from '#server/modules/catalog/catalog.repository.ts'
import en from '../messages/en.json' with { type: 'json' }
import { commerceFixture } from './helpers/commerce-fixtures'
import { isolateActorPage } from './helpers/browser-context'

type Fixture = Awaited<ReturnType<typeof commerceFixture>>
type ProductRow = { product: Product; variant: ProductVariant }

test.use({ storageState: { cookies: [], origins: [] } })
test.setTimeout(120_000)
test.beforeEach(async ({ page }) => { await isolateActorPage(page) })
test.afterAll(async () => { await prisma.$disconnect() })

async function isolatedCatalog() {
  const fixture = await commerceFixture()
  const tag = `Projection-${randomUUID()}`
  const category = await prisma.category.create({ data: { name: tag, slug: randomUUID(), isActive: true } })
  const brand = await prisma.brand.create({ data: { name: `Brand-${tag}`, slug: randomUUID(), isActive: true } })
  const first = fixture.shops[0]!
  await prisma.product.update({ where: { id: first.product.id }, data: { status: 'DRAFT' } })
  return { fixture, tag, category, brand }
}

async function productRow(catalog: Awaited<ReturnType<typeof isolatedCatalog>>, input: {
  name: string; price: bigint; createdAt: Date; reserved?: number
}): Promise<ProductRow> {
  const first = catalog.fixture.shops[0]!
  const product = await prisma.product.create({ data: {
    shopId: first.shop.id, sellerProfileId: first.shop.sellerProfileId,
    categoryId: catalog.category.id, brandId: catalog.brand.id,
    title: `${catalog.tag} ${input.name}`, slug: randomUUID(), status: 'ACTIVE', createdAt: input.createdAt,
  } })
  const variant = await prisma.productVariant.create({ data: {
    productId: product.id, sku: randomUUID(), title: 'Default', price: input.price, currency: 'THB', status: 'ACTIVE',
    inventory: { create: { quantityOnHand: 3, quantityReserved: input.reserved ?? 2 } },
  } })
  return { product, variant }
}

async function historicalSale(fixture: Fixture, row: ProductRow, quantity: number, amount: bigint) {
  if (amount % BigInt(quantity) !== 0n) throw new Error('Historical fixture needs whole minor-unit prices')
  const shop = fixture.shops[0]!.shop
  const cart = await prisma.cart.create({ data: { userId: fixture.buyer.id, status: 'CHECKED_OUT' } })
  const checkout = await prisma.checkout.create({ data: {
    cartId: cart.id, userId: fixture.buyer.id, subtotal: amount, grandTotal: amount,
    status: 'COMPLETED', expiresAt: new Date(),
  } })
  const order = await prisma.order.create({ data: {
    checkoutId: checkout.id, userId: fixture.buyer.id, orderNumber: randomUUID(), status: 'DELIVERED',
    paymentStatus: 'SUCCEEDED', subtotal: amount, grandTotal: amount,
    shippingName: 'Projection buyer', shippingLine1: '1 Test Road', shippingCity: 'Bangkok',
    shippingPostalCode: '10110', shippingCountry: 'TH',
  } })
  await prisma.payment.create({ data: {
    orderId: order.id, provider: 'mock', providerIntentId: randomUUID(), status: 'SUCCEEDED', amount, currency: 'THB',
  } })
  const shopOrder = await prisma.shopOrder.create({ data: {
    orderId: order.id, shopId: shop.id, status: 'DELIVERED', fulfillmentStatus: 'DELIVERED', subtotal: amount, grandTotal: amount,
  } })
  const item = await prisma.orderItem.create({ data: {
    orderId: order.id, shopId: shop.id, variantId: row.variant.id, quantity, unitPrice: amount / BigInt(quantity),
    lineTotal: amount, fulfillmentStatus: 'DELIVERED', productTitle: row.product.title, productSlug: row.product.slug,
    variantTitle: row.variant.title, variantSku: row.variant.sku, shopName: shop.name, shopSlug: shop.slug,
  } })
  return { item, shopOrder }
}

async function apiJson(page: Page, path: string) {
  const response = await page.request.get(path)
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.json()
}

async function evidence(page: Page, testInfo: TestInfo, name: string, values: unknown) {
  await testInfo.attach(`${name}-values`, { body: JSON.stringify(values, null, 2), contentType: 'application/json' })
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

test('published ratings reconcile product4.33 and shop4.67 with counts, buckets and public UI', async ({ page }, testInfo) => {
  const fixture = await commerceFixture()
  const first = fixture.shops[0]!
  const ratings = [
    [5, 5, 'PUBLISHED'], [5, 5, 'PUBLISHED'], [3, 4, 'PUBLISHED'],
    [5, 5, 'PENDING'], [5, 5, 'REJECTED'], [5, 5, 'HIDDEN'],
  ] as const
  for (const [index, [productRating, shopRating, status]] of ratings.entries()) {
    const sale = await historicalSale(fixture, first, 1, 10000n)
    await prisma.review.create({ data: {
      userId: fixture.buyer.id, productId: first.product.id, orderItemId: sale.item.id,
      rating: productRating, status,
      body: `Product feedback ${index} ${status}`,
    } })
    await prisma.shopRating.create({ data: {
      userId: fixture.buyer.id, shopId: first.shop.id, shopOrderId: sale.shopOrder.id,
      rating: shopRating, status,
      body: `Shop feedback ${index} ${status}`,
    } })
  }
  await prisma.shop.update({ where: { id: first.shop.id }, data: { ratingAverage: '4.67', ratingCount: 3 } })
  const productDb = await prisma.review.aggregate({ where: { productId: first.product.id, status: 'PUBLISHED' }, _count: true, _sum: { rating: true } })
  const shopDb = await prisma.shopRating.aggregate({ where: { shopId: first.shop.id, status: 'PUBLISHED' }, _count: true, _sum: { rating: true } })
  expect(productDb).toEqual({ _count: 3, _sum: { rating: 13 } })
  expect(shopDb).toEqual({ _count: 3, _sum: { rating: 14 } })
  const productSummary = await apiJson(page, `/api/products/${first.product.id}/rating-summary`)
  expect(productSummary).toEqual({ averageRating: 4.33, totalReviewCount: 3, distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 } })
  const firstPage = await apiJson(page, `/api/products/${first.product.id}/reviews?page=1&limit=2`)
  const secondPage = await apiJson(page, `/api/products/${first.product.id}/reviews?page=2&limit=2`)
  expect(firstPage.items).toHaveLength(2)
  expect(firstPage.meta).toEqual({ page: 1, limit: 2, totalCount: 3, hasNextPage: true })
  expect(secondPage.items).toHaveLength(1)
  expect(secondPage.meta).toEqual({ page: 2, limit: 2, totalCount: 3, hasNextPage: false })
  await page.goto(`/en/products/${first.product.id}`)
  const reviews = page.locator('section').filter({ has: page.getByRole('heading', { name: en.product.reviews, exact: true }) })
  await expect(reviews.getByText('4.3', { exact: true })).toBeVisible()
  await expect(reviews.getByText('3 reviews', { exact: true })).toBeVisible()
  await expect(reviews.locator('article')).toHaveCount(3)
  await expect(reviews.getByText('Product feedback 0 PUBLISHED', { exact: true })).toBeVisible()
  await expect(reviews.getByText('Product feedback 3 PENDING', { exact: true })).toHaveCount(0)
  const fiveStar = reviews.locator('span').filter({ hasText: /^5 star$/ }).locator('..')
  const threeStar = reviews.locator('span').filter({ hasText: /^3 star$/ }).locator('..')
  await expect(fiveStar).toHaveCount(1)
  await expect(threeStar).toHaveCount(1)
  await expect(fiveStar.getByText('2', { exact: true })).toBeVisible()
  await expect(fiveStar.locator('[style]')).toHaveAttribute('style', /width:\s*67%/)
  await expect(threeStar.getByText('1', { exact: true })).toBeVisible()
  await expect(threeStar.locator('[style]')).toHaveAttribute('style', /width:\s*33%/)
  await evidence(page, testInfo, 'published-product-ratings', { productDb, productSummary, firstPage, secondPage })

  const shopSummary = await apiJson(page, `/api/shops/${first.shop.id}/rating-summary`)
  expect(shopSummary).toEqual({ averageRating: 4.67, totalReviewCount: 3, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 } })
  const storedShop = await prisma.shop.findUniqueOrThrow({ where: { id: first.shop.id } })
  expect(storedShop.ratingAverage.toString()).toBe('4.67')
  expect(storedShop.ratingCount).toBe(3)
  const shopFeed = await apiJson(page, `/api/shops/${first.shop.id}/reviews/feed?page=1&limit=2`)
  expect(shopFeed.items).toHaveLength(2)
  expect(shopFeed.meta).toEqual({ page: 1, pageSize: 2, totalCount: 3, hasNextPage: true })
  const storefrontResponse = await page.goto(`/en/shops/${first.shop.slug}`)
  expect(storefrontResponse?.status()).toBe(200)
  await expect(page.locator('a[href="#reviews"]')).toHaveText(/^4\.7 · 3 /)
  await expect(page.locator('#reviews article')).toHaveCount(3)
  await expect(page.locator('#reviews').getByText('Shop feedback 0 PUBLISHED', { exact: true })).toBeVisible()
  await expect(page.locator('#reviews').getByText('Shop feedback 3 PENDING', { exact: true })).toHaveCount(0)
  await evidence(page, testInfo, 'published-shop-ratings', { shopDb, shopSummary, shopFeed, storedAverage: storedShop.ratingAverage.toString(), storedCount: storedShop.ratingCount })
})

test('search badges99/100, ratings and stock facets reconcile with paid history and reserved inventory', async ({ page }, testInfo) => {
  const catalog = await isolatedCatalog()
  const now = new Date()
  const old = await productRow(catalog, { name: 'old99', price: 1000n, createdAt: new Date(now.getTime() - 8 * 86_400_000) })
  const fresh = await productRow(catalog, { name: 'new100', price: 2000n, createdAt: now })
  const blocked = await productRow(catalog, { name: 'fully-reserved', price: 500n, createdAt: now, reserved: 3 })
  for (const [row, quantity, amount, rating] of [[old, 99, 99000n, 3], [fresh, 100, 200000n, 4]] as const) {
    const sale = await historicalSale(catalog.fixture, row, quantity, amount)
    await prisma.review.create({ data: { userId: catalog.fixture.buyer.id, productId: row.product.id, orderItemId: sale.item.id, rating, status: 'PUBLISHED' } })
  }
  const query = `q=${encodeURIComponent(catalog.tag)}&inStock=true&sort=top_sales`
  const result = await apiJson(page, `/api/search/products?${query}&locale=en`)
  expect(result.items.map((item: MoneyDto<ProductSearchItem>) => ({
    id: item.productId, sold: item.soldCount, badges: item.badges, price: item.minPrice, rating: item.ratingSummary,
  }))).toEqual([
    { id: fresh.product.id, sold: 100, badges: ['new', 'best_seller', 'in_stock'], price: '2000', rating: { averageRating: 4, totalReviewCount: 1 } },
    { id: old.product.id, sold: 99, badges: ['in_stock'], price: '1000', rating: { averageRating: 3, totalReviewCount: 1 } },
  ])
  expect(result.meta.totalCount).toBe(2)
  expect(result.facets.categories).toEqual([{ id: catalog.category.id, name: catalog.category.name, slug: catalog.category.slug, count: 2, active: false }])
  expect(result.facets.brands).toEqual([{ id: catalog.brand.id, name: catalog.brand.name, slug: catalog.brand.slug, count: 2, active: false }])
  expect(result.facets.price).toEqual({ min: '1000', max: '2000', currency: 'THB' })
  const stock = await prisma.inventory.findUniqueOrThrow({ where: { variantId: blocked.variant.id } })
  expect(stock).toMatchObject({ quantityOnHand: 3, quantityReserved: 3 })
  const sold = await prisma.orderItem.aggregate({ where: { variantId: fresh.variant.id, order: { paymentStatus: 'SUCCEEDED', status: { not: 'CANCELED' } } }, _sum: { quantity: true } })
  expect(sold).toEqual({ _sum: { quantity: 100 } })
  await page.goto(`/en/search?${query}`)
  const freshCard = page.locator('article').filter({ has: page.getByRole('heading', { name: fresh.product.title, exact: true }) })
  const oldCard = page.locator('article').filter({ has: page.getByRole('heading', { name: old.product.title, exact: true }) })
  await expect(freshCard.getByText('100 sold', { exact: true })).toBeVisible()
  await expect(freshCard.getByText('4.0', { exact: true })).toBeVisible()
  await expect(freshCard.getByText(en.product.new, { exact: true })).toBeVisible()
  await expect(freshCard.getByText(en.product.bestSeller, { exact: true })).toBeVisible()
  await expect(freshCard.locator('p[title="฿20.00"]')).toBeVisible()
  await expect(oldCard.getByText('99 sold', { exact: true })).toBeVisible()
  await expect(oldCard.getByText('3.0', { exact: true })).toBeVisible()
  await expect(oldCard.getByText(en.product.inStock, { exact: true })).toBeVisible()
  await expect(oldCard.getByText(en.product.bestSeller, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: blocked.product.title, exact: true })).toHaveCount(0)
  await expect(page.getByText('2 items found', { exact: true })).toBeVisible()
  const filterButton = page.getByRole('button', { name: new RegExp(en.product.filterAndSort) })
  if (await filterButton.isVisible()) await filterButton.click()
  const filters = page.locator('aside:visible')
  await expect(filters.getByRole('link').filter({ has: page.getByText(catalog.category.name, { exact: true }) })).toHaveText(`${catalog.category.name}2`)
  await expect(filters.getByRole('link').filter({ has: page.getByText(catalog.brand.name, { exact: true }) })).toHaveText(`${catalog.brand.name}2`)
  await expect(filters.locator('input[name="minPrice"]')).toHaveAttribute('placeholder', '1000')
  await expect(filters.locator('input[name="maxPrice"]')).toHaveAttribute('placeholder', '2000')
  await evidence(page, testInfo, 'search-stock-badges-facets', { result, blockedStock: { onHand: stock.quantityOnHand, reserved: stock.quantityReserved }, sold })

  const filteredQuery = `${query}&rating=4&minPrice=1000&maxPrice=2000`
  const filtered = await apiJson(page, `/api/search/products?${filteredQuery}&locale=en`)
  expect(filtered.items.map((item: MoneyDto<ProductSearchItem>) => item.productId)).toEqual([fresh.product.id])
  expect(filtered.meta.totalCount).toBe(1)
  await page.goto(`/en/search?${filteredQuery}`)
  await expect(page.getByRole('heading', { name: fresh.product.title, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: old.product.title, exact: true })).toHaveCount(0)
  await expect(page.getByText('1 items found', { exact: true })).toBeVisible()
  await evidence(page, testInfo, 'search-rating-price-filter', { filtered })
})

test('related rail prices match Catalog API and DB while similar API includes500/1500 edges only', async ({ page }, testInfo) => {
  const catalog = await isolatedCatalog()
  const source = await productRow(catalog, { name: 'source1000', price: 1000n, createdAt: new Date() })
  const lowerOutside = await productRow(catalog, { name: 'outside499', price: 499n, createdAt: new Date('2026-10-01T00:00:01Z') })
  const lower = await productRow(catalog, { name: 'edge500', price: 500n, createdAt: new Date('2026-10-01T00:00:02Z') })
  const upper = await productRow(catalog, { name: 'edge1500', price: 1500n, createdAt: new Date('2026-10-01T00:00:03Z') })
  const upperOutside = await productRow(catalog, { name: 'outside1501', price: 1501n, createdAt: new Date('2026-10-01T00:00:04Z') })
  const stored = await prisma.productVariant.findMany({ where: { productId: { in: [lowerOutside.product.id, lower.product.id, upper.product.id, upperOutside.product.id] } }, orderBy: { price: 'asc' } })
  expect(stored.map((variant) => variant.price)).toEqual([499n, 500n, 1500n, 1501n])
  const similar = await apiJson(page, `/api/recommendations/similar/${source.product.id}?locale=en`)
  expect(similar.items.map((item: MoneyDto<RecommendationProductCard>) => ({ id: item.productId, price: item.minPrice }))).toEqual([
    { id: upper.product.id, price: '1500' }, { id: lower.product.id, price: '500' },
  ])
  const related = await apiJson(page, `/api/products/${source.product.id}/related?limit=4&locale=en`)
  expect(related.map((product: MoneyDto<CatalogProductListItem>) => ({ id: product.id, price: product.variants[0]!.price }))).toEqual([
    { id: upperOutside.product.id, price: '1501' }, { id: upper.product.id, price: '1500' },
    { id: lower.product.id, price: '500' }, { id: lowerOutside.product.id, price: '499' },
  ])
  await page.goto(`/en/products/${source.product.id}`)
  const rail = page.locator('section').filter({ has: page.getByRole('heading', { name: en.product.relatedProducts, exact: true }) })
  await expect(rail.locator('article')).toHaveCount(4)
  for (const [row, priceLabel] of [[lowerOutside, '฿4.99'], [lower, '฿5.00'], [upper, '฿15.00'], [upperOutside, '฿15.01']] as const) {
    const card = rail.locator('article').filter({ has: page.getByRole('heading', { name: row.product.title, exact: true }) })
    await expect(card).toHaveCount(1)
    await expect(card.locator('p[title]').filter({ hasText: priceLabel })).toHaveAttribute('title', priceLabel)
  }
  await evidence(page, testInfo, 'related-and-similar-price-contracts', { related, similar, storedPrices: stored.map((variant) => variant.price.toString()) })
})
