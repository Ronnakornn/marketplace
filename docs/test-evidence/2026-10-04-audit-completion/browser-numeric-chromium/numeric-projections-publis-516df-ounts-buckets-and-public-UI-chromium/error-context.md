# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: numeric-projections.spec.ts >> published ratings reconcile product4.33 and shop4.67 with counts, buckets and public UI
- Location: e2e\numeric-projections.spec.ts:88:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: locator('a[href="#reviews"]')
Expected pattern: /^4\.7 · 3 /
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toHaveText" with timeout 10000ms
  - waiting for locator('a[href="#reviews"]')

```

```yaml
- heading "Page not found" [level=1]
- paragraph: The page you are looking for does not exist or is unavailable.
- link "Back to home":
  - /url: /
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  47  | async function historicalSale(fixture: Fixture, row: ProductRow, quantity: number, amount: bigint) {
  48  |   if (amount % BigInt(quantity) !== 0n) throw new Error('Historical fixture needs whole minor-unit prices')
  49  |   const shop = fixture.shops[0]!.shop
  50  |   const cart = await prisma.cart.create({ data: { userId: fixture.buyer.id, status: 'CHECKED_OUT' } })
  51  |   const checkout = await prisma.checkout.create({ data: {
  52  |     cartId: cart.id, userId: fixture.buyer.id, subtotal: amount, grandTotal: amount,
  53  |     status: 'COMPLETED', expiresAt: new Date(),
  54  |   } })
  55  |   const order = await prisma.order.create({ data: {
  56  |     checkoutId: checkout.id, userId: fixture.buyer.id, orderNumber: randomUUID(), status: 'DELIVERED',
  57  |     paymentStatus: 'SUCCEEDED', subtotal: amount, grandTotal: amount,
  58  |     shippingName: 'Projection buyer', shippingLine1: '1 Test Road', shippingCity: 'Bangkok',
  59  |     shippingPostalCode: '10110', shippingCountry: 'TH',
  60  |   } })
  61  |   await prisma.payment.create({ data: {
  62  |     orderId: order.id, provider: 'mock', providerIntentId: randomUUID(), status: 'SUCCEEDED', amount, currency: 'THB',
  63  |   } })
  64  |   const shopOrder = await prisma.shopOrder.create({ data: {
  65  |     orderId: order.id, shopId: shop.id, status: 'DELIVERED', fulfillmentStatus: 'DELIVERED', subtotal: amount, grandTotal: amount,
  66  |   } })
  67  |   const item = await prisma.orderItem.create({ data: {
  68  |     orderId: order.id, shopId: shop.id, variantId: row.variant.id, quantity, unitPrice: amount / BigInt(quantity),
  69  |     lineTotal: amount, fulfillmentStatus: 'DELIVERED', productTitle: row.product.title, productSlug: row.product.slug,
  70  |     variantTitle: row.variant.title, variantSku: row.variant.sku, shopName: shop.name, shopSlug: shop.slug,
  71  |   } })
  72  |   return { item, shopOrder }
  73  | }
  74  | 
  75  | async function apiJson(page: Page, path: string) {
  76  |   const response = await page.request.get(path)
  77  |   expect(response.ok(), await response.text()).toBeTruthy()
  78  |   return response.json()
  79  | }
  80  | 
  81  | async function evidence(page: Page, testInfo: TestInfo, name: string, values: unknown) {
  82  |   await testInfo.attach(`${name}-values`, { body: JSON.stringify(values, null, 2), contentType: 'application/json' })
  83  |   const path = testInfo.outputPath(`${name}.png`)
  84  |   await page.screenshot({ path, fullPage: true })
  85  |   await testInfo.attach(name, { path, contentType: 'image/png' })
  86  | }
  87  | 
  88  | test('published ratings reconcile product4.33 and shop4.67 with counts, buckets and public UI', async ({ page }, testInfo) => {
  89  |   const fixture = await commerceFixture()
  90  |   const first = fixture.shops[0]!
  91  |   const ratings = [
  92  |     [5, 5, 'PUBLISHED'], [5, 5, 'PUBLISHED'], [3, 4, 'PUBLISHED'],
  93  |     [5, 5, 'PENDING'], [5, 5, 'REJECTED'], [5, 5, 'HIDDEN'],
  94  |   ] as const
  95  |   for (const [index, [productRating, shopRating, status]] of ratings.entries()) {
  96  |     const sale = await historicalSale(fixture, first, 1, 10000n)
  97  |     await prisma.review.create({ data: {
  98  |       userId: fixture.buyer.id, productId: first.product.id, orderItemId: sale.item.id,
  99  |       rating: productRating, status,
  100 |       body: `Product feedback ${index} ${status}`,
  101 |     } })
  102 |     await prisma.shopRating.create({ data: {
  103 |       userId: fixture.buyer.id, shopId: first.shop.id, shopOrderId: sale.shopOrder.id,
  104 |       rating: shopRating, status,
  105 |       body: `Shop feedback ${index} ${status}`,
  106 |     } })
  107 |   }
  108 |   await prisma.shop.update({ where: { id: first.shop.id }, data: { ratingAverage: '4.67', ratingCount: 3 } })
  109 |   const productDb = await prisma.review.aggregate({ where: { productId: first.product.id, status: 'PUBLISHED' }, _count: true, _sum: { rating: true } })
  110 |   const shopDb = await prisma.shopRating.aggregate({ where: { shopId: first.shop.id, status: 'PUBLISHED' }, _count: true, _sum: { rating: true } })
  111 |   expect(productDb).toEqual({ _count: 3, _sum: { rating: 13 } })
  112 |   expect(shopDb).toEqual({ _count: 3, _sum: { rating: 14 } })
  113 |   const productSummary = await apiJson(page, `/api/products/${first.product.id}/rating-summary`)
  114 |   expect(productSummary).toEqual({ averageRating: 4.33, totalReviewCount: 3, distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 } })
  115 |   const firstPage = await apiJson(page, `/api/products/${first.product.id}/reviews?page=1&limit=2`)
  116 |   const secondPage = await apiJson(page, `/api/products/${first.product.id}/reviews?page=2&limit=2`)
  117 |   expect(firstPage.items).toHaveLength(2)
  118 |   expect(firstPage.meta).toEqual({ page: 1, limit: 2, totalCount: 3, hasNextPage: true })
  119 |   expect(secondPage.items).toHaveLength(1)
  120 |   expect(secondPage.meta).toEqual({ page: 2, limit: 2, totalCount: 3, hasNextPage: false })
  121 |   await page.goto(`/en/products/${first.product.id}`)
  122 |   const reviews = page.locator('section').filter({ has: page.getByRole('heading', { name: en.product.reviews, exact: true }) })
  123 |   await expect(reviews.getByText('4.3', { exact: true })).toBeVisible()
  124 |   await expect(reviews.getByText('3 reviews', { exact: true })).toBeVisible()
  125 |   await expect(reviews.locator('article')).toHaveCount(3)
  126 |   await expect(reviews.getByText('Product feedback 0 PUBLISHED', { exact: true })).toBeVisible()
  127 |   await expect(reviews.getByText('Product feedback 3 PENDING', { exact: true })).toHaveCount(0)
  128 |   const fiveStar = reviews.locator('span').filter({ hasText: /^5 star$/ }).locator('..')
  129 |   const threeStar = reviews.locator('span').filter({ hasText: /^3 star$/ }).locator('..')
  130 |   await expect(fiveStar).toHaveCount(1)
  131 |   await expect(threeStar).toHaveCount(1)
  132 |   await expect(fiveStar.getByText('2', { exact: true })).toBeVisible()
  133 |   await expect(fiveStar.locator('[style]')).toHaveAttribute('style', /width:\s*67%/)
  134 |   await expect(threeStar.getByText('1', { exact: true })).toBeVisible()
  135 |   await expect(threeStar.locator('[style]')).toHaveAttribute('style', /width:\s*33%/)
  136 |   await evidence(page, testInfo, 'published-product-ratings', { productDb, productSummary, firstPage, secondPage })
  137 | 
  138 |   const shopSummary = await apiJson(page, `/api/shops/${first.shop.id}/rating-summary`)
  139 |   expect(shopSummary).toEqual({ averageRating: 4.67, totalReviewCount: 3, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 } })
  140 |   const storedShop = await prisma.shop.findUniqueOrThrow({ where: { id: first.shop.id } })
  141 |   expect(storedShop.ratingAverage.toString()).toBe('4.67')
  142 |   expect(storedShop.ratingCount).toBe(3)
  143 |   const shopFeed = await apiJson(page, `/api/shops/${first.shop.id}/reviews/feed?page=1&limit=2`)
  144 |   expect(shopFeed.items).toHaveLength(2)
  145 |   expect(shopFeed.meta).toEqual({ page: 1, pageSize: 2, totalCount: 3, hasNextPage: true })
  146 |   await page.goto(`/en/shops/${first.shop.slug}`)
> 147 |   await expect(page.locator('a[href="#reviews"]')).toHaveText(/^4\.7 · 3 /)
      |                                                    ^ Error: expect(locator).toHaveText(expected) failed
  148 |   await expect(page.locator('#reviews article')).toHaveCount(3)
  149 |   await expect(page.locator('#reviews').getByText('Shop feedback 0 PUBLISHED', { exact: true })).toBeVisible()
  150 |   await expect(page.locator('#reviews').getByText('Shop feedback 3 PENDING', { exact: true })).toHaveCount(0)
  151 |   await evidence(page, testInfo, 'published-shop-ratings', { shopDb, shopSummary, shopFeed, storedAverage: storedShop.ratingAverage.toString(), storedCount: storedShop.ratingCount })
  152 | })
  153 | 
  154 | test('search badges99/100, ratings and stock facets reconcile with paid history and reserved inventory', async ({ page }, testInfo) => {
  155 |   const catalog = await isolatedCatalog()
  156 |   const now = new Date()
  157 |   const old = await productRow(catalog, { name: 'old99', price: 1000n, createdAt: new Date(now.getTime() - 8 * 86_400_000) })
  158 |   const fresh = await productRow(catalog, { name: 'new100', price: 2000n, createdAt: now })
  159 |   const blocked = await productRow(catalog, { name: 'fully-reserved', price: 500n, createdAt: now, reserved: 3 })
  160 |   for (const [row, quantity, amount, rating] of [[old, 99, 99000n, 3], [fresh, 100, 200000n, 4]] as const) {
  161 |     const sale = await historicalSale(catalog.fixture, row, quantity, amount)
  162 |     await prisma.review.create({ data: { userId: catalog.fixture.buyer.id, productId: row.product.id, orderItemId: sale.item.id, rating, status: 'PUBLISHED' } })
  163 |   }
  164 |   const query = `q=${encodeURIComponent(catalog.tag)}&inStock=true&sort=top_sales`
  165 |   const result = await apiJson(page, `/api/search/products?${query}&locale=en`)
  166 |   expect(result.items.map((item: MoneyDto<ProductSearchItem>) => ({
  167 |     id: item.productId, sold: item.soldCount, badges: item.badges, price: item.minPrice, rating: item.ratingSummary,
  168 |   }))).toEqual([
  169 |     { id: fresh.product.id, sold: 100, badges: ['new', 'best_seller', 'in_stock'], price: '2000', rating: { averageRating: 4, totalReviewCount: 1 } },
  170 |     { id: old.product.id, sold: 99, badges: ['in_stock'], price: '1000', rating: { averageRating: 3, totalReviewCount: 1 } },
  171 |   ])
  172 |   expect(result.meta.totalCount).toBe(2)
  173 |   expect(result.facets.categories).toEqual([{ id: catalog.category.id, name: catalog.category.name, slug: catalog.category.slug, count: 2, active: false }])
  174 |   expect(result.facets.brands).toEqual([{ id: catalog.brand.id, name: catalog.brand.name, slug: catalog.brand.slug, count: 2, active: false }])
  175 |   expect(result.facets.price).toEqual({ min: '1000', max: '2000', currency: 'THB' })
  176 |   const stock = await prisma.inventory.findUniqueOrThrow({ where: { variantId: blocked.variant.id } })
  177 |   expect(stock).toMatchObject({ quantityOnHand: 3, quantityReserved: 3 })
  178 |   const sold = await prisma.orderItem.aggregate({ where: { variantId: fresh.variant.id, order: { paymentStatus: 'SUCCEEDED', status: { not: 'CANCELED' } } }, _sum: { quantity: true } })
  179 |   expect(sold).toEqual({ _sum: { quantity: 100 } })
  180 |   await page.goto(`/en/search?${query}`)
  181 |   const freshCard = page.locator('article').filter({ has: page.getByRole('heading', { name: fresh.product.title, exact: true }) })
  182 |   const oldCard = page.locator('article').filter({ has: page.getByRole('heading', { name: old.product.title, exact: true }) })
  183 |   await expect(freshCard.getByText('100 sold', { exact: true })).toBeVisible()
  184 |   await expect(freshCard.getByText('4.0', { exact: true })).toBeVisible()
  185 |   await expect(freshCard.getByText(en.product.new, { exact: true })).toBeVisible()
  186 |   await expect(freshCard.getByText(en.product.bestSeller, { exact: true })).toBeVisible()
  187 |   await expect(freshCard.locator('p[title="฿20.00"]')).toBeVisible()
  188 |   await expect(oldCard.getByText('99 sold', { exact: true })).toBeVisible()
  189 |   await expect(oldCard.getByText('3.0', { exact: true })).toBeVisible()
  190 |   await expect(oldCard.getByText(en.product.inStock, { exact: true })).toBeVisible()
  191 |   await expect(oldCard.getByText(en.product.bestSeller, { exact: true })).toHaveCount(0)
  192 |   await expect(page.getByRole('heading', { name: blocked.product.title, exact: true })).toHaveCount(0)
  193 |   await expect(page.getByText('2 items found', { exact: true })).toBeVisible()
  194 |   const filterButton = page.getByRole('button', { name: new RegExp(en.product.filterAndSort) })
  195 |   if (await filterButton.isVisible()) await filterButton.click()
  196 |   const filters = page.locator('aside:visible')
  197 |   await expect(filters.getByRole('link').filter({ hasText: catalog.category.name })).toHaveText(`${catalog.category.name}2`)
  198 |   await expect(filters.getByRole('link').filter({ hasText: catalog.brand.name })).toHaveText(`${catalog.brand.name}2`)
  199 |   await expect(filters.locator('input[name="minPrice"]')).toHaveAttribute('placeholder', '1000')
  200 |   await expect(filters.locator('input[name="maxPrice"]')).toHaveAttribute('placeholder', '2000')
  201 |   await evidence(page, testInfo, 'search-stock-badges-facets', { result, blockedStock: { onHand: stock.quantityOnHand, reserved: stock.quantityReserved }, sold })
  202 | 
  203 |   const filteredQuery = `${query}&rating=4&minPrice=1000&maxPrice=2000`
  204 |   const filtered = await apiJson(page, `/api/search/products?${filteredQuery}&locale=en`)
  205 |   expect(filtered.items.map((item: MoneyDto<ProductSearchItem>) => item.productId)).toEqual([fresh.product.id])
  206 |   expect(filtered.meta.totalCount).toBe(1)
  207 |   await page.goto(`/en/search?${filteredQuery}`)
  208 |   await expect(page.getByRole('heading', { name: fresh.product.title, exact: true })).toBeVisible()
  209 |   await expect(page.getByRole('heading', { name: old.product.title, exact: true })).toHaveCount(0)
  210 |   await expect(page.getByText('1 items found', { exact: true })).toBeVisible()
  211 |   await evidence(page, testInfo, 'search-rating-price-filter', { filtered })
  212 | })
  213 | 
  214 | test('related rail prices match Catalog API and DB while similar API includes500/1500 edges only', async ({ page }, testInfo) => {
  215 |   const catalog = await isolatedCatalog()
  216 |   const source = await productRow(catalog, { name: 'source1000', price: 1000n, createdAt: new Date() })
  217 |   const lowerOutside = await productRow(catalog, { name: 'outside499', price: 499n, createdAt: new Date('2026-10-01T00:00:01Z') })
  218 |   const lower = await productRow(catalog, { name: 'edge500', price: 500n, createdAt: new Date('2026-10-01T00:00:02Z') })
  219 |   const upper = await productRow(catalog, { name: 'edge1500', price: 1500n, createdAt: new Date('2026-10-01T00:00:03Z') })
  220 |   const upperOutside = await productRow(catalog, { name: 'outside1501', price: 1501n, createdAt: new Date('2026-10-01T00:00:04Z') })
  221 |   const stored = await prisma.productVariant.findMany({ where: { productId: { in: [lowerOutside.product.id, lower.product.id, upper.product.id, upperOutside.product.id] } }, orderBy: { price: 'asc' } })
  222 |   expect(stored.map((variant) => variant.price)).toEqual([499n, 500n, 1500n, 1501n])
  223 |   const similar = await apiJson(page, `/api/recommendations/similar/${source.product.id}?locale=en`)
  224 |   expect(similar.items.map((item: MoneyDto<RecommendationProductCard>) => ({ id: item.productId, price: item.minPrice }))).toEqual([
  225 |     { id: upper.product.id, price: '1500' }, { id: lower.product.id, price: '500' },
  226 |   ])
  227 |   const related = await apiJson(page, `/api/products/${source.product.id}/related?limit=4&locale=en`)
  228 |   expect(related.map((product: MoneyDto<CatalogProductListItem>) => ({ id: product.id, price: product.variants[0]!.price }))).toEqual([
  229 |     { id: upperOutside.product.id, price: '1501' }, { id: upper.product.id, price: '1500' },
  230 |     { id: lower.product.id, price: '500' }, { id: lowerOutside.product.id, price: '499' },
  231 |   ])
  232 |   await page.goto(`/en/products/${source.product.id}`)
  233 |   const rail = page.locator('section').filter({ has: page.getByRole('heading', { name: en.product.relatedProducts, exact: true }) })
  234 |   await expect(rail.locator('article')).toHaveCount(4)
  235 |   for (const [row, priceLabel] of [[lowerOutside, '฿4.99'], [lower, '฿5.00'], [upper, '฿15.00'], [upperOutside, '฿15.01']] as const) {
  236 |     const card = rail.locator('article').filter({ has: rail.getByRole('heading', { name: row.product.title, exact: true }) })
  237 |     await expect(card.locator('p[title]').filter({ hasText: priceLabel })).toHaveAttribute('title', priceLabel)
  238 |   }
  239 |   await evidence(page, testInfo, 'related-and-similar-price-contracts', { related, similar, storedPrices: stored.map((variant) => variant.price.toString()) })
  240 | })
  241 | 
```