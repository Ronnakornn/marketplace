# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: numeric-projections.spec.ts >> related rail prices match Catalog API and DB while similar API includes500/1500 edges only
- Location: e2e\numeric-projections.spec.ts:214:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: locator('section').filter({ has: getByRole('heading', { name: 'Related products', exact: true }) }).locator('article').filter({ has: locator('section').filter({ has: getByRole('heading', { name: 'Related products', exact: true }) }).getByRole('heading', { name: 'Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 outside499', exact: true }) }).locator('p[title]').filter({ hasText: '฿4.99' })
Expected: "฿4.99"
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" with timeout 10000ms
  - waiting for locator('section').filter({ has: getByRole('heading', { name: 'Related products', exact: true }) }).locator('article').filter({ has: locator('section').filter({ has: getByRole('heading', { name: 'Related products', exact: true }) }).getByRole('heading', { name: 'Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 outside499', exact: true }) }).locator('p[title]').filter({ hasText: '฿4.99' })

```

```yaml
- banner:
  - link "Marketplace":
    - /url: /en
  - textbox "Search deals, brands, and shops"
  - link "Notifications":
    - /url: /en/notifications
  - link "Sign in":
    - /url: /en/login
  - link "Sign up":
    - /url: /en/signup
  - paragraph: Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 source1000
  - link "ไทย":
    - /url: /th/products/be2b0875-ac34-4d08-91d4-e767e23877aa
  - link "EN":
    - /url: /en/products/be2b0875-ac34-4d08-91d4-e767e23877aa
- article:
  - img "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 source1000 has no product images":
    - paragraph: No product image available
  - text: Brand-Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 Extended Shop 5ad9f737
  - button "Follow shop"
  - heading "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 source1000" [level=1]
  - text: 0.0 0 sold 1 in stock
  - paragraph: ฿10.00
  - heading "Variants" [level=2]
  - button "Default" [pressed]
  - paragraph: Selected variant
  - paragraph: Default | SKU 4e17cabc-6c5a-490c-b13e-fa4910e8b501
  - text: 1 in stock
  - paragraph: Log in to add this item to your cart.
  - text: Quantity
  - paragraph: Maximum 1
  - button "Decrease quantity" [disabled]
  - text: "1"
  - button "Increase quantity" [disabled]
  - text: Shipping Shipping calculated at checkout Buyer protection Buyer protection on eligible orders Returns Returns follow marketplace policy.
  - heading "Highlights" [level=2]
  - paragraph: Quick seller-provided notes for this product.
  - paragraph: No highlights provided.
  - region "Shop trust":
    - paragraph: Sold by
    - heading "Extended Shop 5ad9f737" [level=2]
    - text: Active marketplace shop
    - button "Chat seller"
    - button "Follow shop"
  - heading "Product facts" [level=2]
  - text: 1 facts
  - paragraph: Seller-provided facts and catalog attributes.
  - term: Brand
  - definition: Brand-Projection-5fa23eee-7fb5-437c-893d-cb66c291a635
  - heading "Description" [level=2]
  - paragraph: Product details from the seller.
  - paragraph: No product description yet.
  - heading "Reviews" [level=2]
  - paragraph: Published buyer feedback and rating summary.
  - text: "0.0"
  - paragraph: 0 reviews
  - button "All ratings" [pressed]
  - button "5 star"
  - button "4 star"
  - button "3 star"
  - button "2 star"
  - button "1 star"
  - button "All reviews" [pressed]
  - button "With media"
  - button "With comment"
  - button "Latest" [pressed]
  - button "Rating high"
  - button "Rating low"
  - heading "No reviews yet" [level=2]
  - paragraph: Published buyer reviews will appear here.
  - heading "Questions & answers" [level=2]
  - paragraph: Ask the seller about sizing, packaging, warranty, or product details.
  - button "Log in to ask a question"
  - button "All questions" [pressed]
  - button "Answered"
  - button "Unanswered"
  - button "Latest" [pressed]
  - button "Oldest"
  - heading "No questions yet" [level=2]
  - paragraph: Buyer questions and seller answers will appear here.
  - heading "Related products" [level=2]
  - text: 4 shown
  - paragraph: Continue browsing similar or recently viewed items.
  - article:
    - link "View Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 outside1501":
      - /url: /en/products/415ab066-9357-4b1e-aabf-ee752c2b1968
      - img "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 outside1501"
    - text: Low Stock
    - button "Sign in as a buyer to use wishlist" [disabled]
    - link "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 outside1501":
      - /url: /en/products/415ab066-9357-4b1e-aabf-ee752c2b1968
      - heading "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 outside1501" [level=3]
    - paragraph: Brand-Projection-5fa23eee-7fb5-437c-893d-cb66c291a635
    - paragraph: ฿15.01
    - text: 0 sold 0.0 Extended Shop 5ad9f737
    - button "Quick add Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 outside1501 to cart" [disabled]
    - paragraph: Only buyer accounts can purchase.
  - article:
    - link "View Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 edge1500":
      - /url: /en/products/819d39b9-4077-4ef5-9f02-e95bd4ee0762
      - img "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 edge1500"
    - text: Low Stock
    - button "Sign in as a buyer to use wishlist" [disabled]
    - link "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 edge1500":
      - /url: /en/products/819d39b9-4077-4ef5-9f02-e95bd4ee0762
      - heading "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 edge1500" [level=3]
    - paragraph: Brand-Projection-5fa23eee-7fb5-437c-893d-cb66c291a635
    - paragraph: ฿15.00
    - text: 0 sold 0.0 Extended Shop 5ad9f737
    - button "Quick add Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 edge1500 to cart" [disabled]
    - paragraph: Only buyer accounts can purchase.
  - article:
    - link "View Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 edge500":
      - /url: /en/products/f8692dad-91a1-41f9-96e3-3fe96fad4060
      - img "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 edge500"
    - text: Low Stock
    - button "Sign in as a buyer to use wishlist" [disabled]
    - link "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 edge500":
      - /url: /en/products/f8692dad-91a1-41f9-96e3-3fe96fad4060
      - heading "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 edge500" [level=3]
    - paragraph: Brand-Projection-5fa23eee-7fb5-437c-893d-cb66c291a635
    - paragraph: ฿5.00
    - text: 0 sold 0.0 Extended Shop 5ad9f737
    - button "Quick add Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 edge500 to cart" [disabled]
    - paragraph: Only buyer accounts can purchase.
  - article:
    - link "View Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 outside499":
      - /url: /en/products/8c63d023-418c-4b28-9fbf-118b7b3a0a7b
      - img "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 outside499"
    - text: Low Stock
    - button "Sign in as a buyer to use wishlist" [disabled]
    - link "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 outside499":
      - /url: /en/products/8c63d023-418c-4b28-9fbf-118b7b3a0a7b
      - heading "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 outside499" [level=3]
    - paragraph: Brand-Projection-5fa23eee-7fb5-437c-893d-cb66c291a635
    - paragraph: ฿4.99
    - text: 0 sold 0.0 Extended Shop 5ad9f737
    - button "Quick add Projection-5fa23eee-7fb5-437c-893d-cb66c291a635 outside499 to cart" [disabled]
    - paragraph: Only buyer accounts can purchase.
  - heading "Recently viewed" [level=2]
  - paragraph: Products you viewed earlier will appear here.
  - paragraph: No recently viewed products
  - paragraph: Products you viewed earlier will appear here.
- paragraph: ฿10.00
- paragraph: Default | SKU 4e17cabc-6c5a-490c-b13e-fa4910e8b501 | Qty 1
- paragraph: Log in to add this item to your cart.
- paragraph: Log in to add this item to your cart.
- paragraph: Qty
- paragraph: "1"
- button "Add to wishlist": Wishlist
- button "Chat seller"
- button "Add to cart"
- button "Buy now"
- region "Notifications alt+T"
- alert
```

# Test source

```ts
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
  147 |   await expect(page.locator('a[href="#reviews"]')).toHaveText(/^4\.7 · 3 /)
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
> 237 |     await expect(card.locator('p[title]').filter({ hasText: priceLabel })).toHaveAttribute('title', priceLabel)
      |                                                                            ^ Error: expect(locator).toHaveAttribute(expected) failed
  238 |   }
  239 |   await evidence(page, testInfo, 'related-and-similar-price-contracts', { related, similar, storedPrices: stored.map((variant) => variant.price.toString()) })
  240 | })
  241 | 
```