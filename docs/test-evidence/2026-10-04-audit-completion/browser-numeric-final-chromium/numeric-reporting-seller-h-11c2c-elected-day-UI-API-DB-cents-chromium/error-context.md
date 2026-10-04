# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: numeric-reporting.spec.ts >> seller historical daily reports assign midnight17UTC to Bangkok and reconcile selected-day UI API DB cents
- Location: e2e\numeric-reporting.spec.ts:19:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('img', { name: '2026-09-30 views: 1', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('img', { name: '2026-09-30 views: 1', exact: true })

```

```yaml
- link "Seller Manage Extended Shop c062ce58":
  - /url: /en/seller?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
- list:
  - listitem:
    - link "Dashboard":
      - /url: /en/seller?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
  - listitem:
    - link "Shop profile":
      - /url: /en/seller/shop?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
  - listitem:
    - link "Products":
      - /url: /en/seller/products?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
  - listitem:
    - link "Product Analytics":
      - /url: /en/seller/analytics/products?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
  - listitem:
    - link "Inventory":
      - /url: /en/seller/inventory?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
  - listitem:
    - link "Orders":
      - /url: /en/seller/orders?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
  - listitem:
    - link "Returns":
      - /url: /en/seller/returns?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
  - listitem:
    - link "Promotions":
      - /url: /en/seller/promotions?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
  - listitem:
    - link "Finance":
      - /url: /en/seller/finance?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
  - listitem:
    - link "Chat":
      - /url: /en/seller/chat?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
  - listitem:
    - link "Notifications":
      - /url: /en/seller/notifications?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
  - listitem:
    - link "Staff":
      - /url: /en/seller/staff?shopId=00000000-0d79-4741-8acb-3af26d36f9e5
- list:
  - listitem:
    - button "E Extended Seller 1 a7a5c3a6-6d57-425b-aa34-f633e6a5e3ba@example.test"
- button "Toggle Sidebar"
- main:
  - button "Toggle Sidebar"
  - main:
    - paragraph: Seller manage
    - heading "Product Analytics" [level=1]
    - paragraph: Measure product demand, SKU sales, and conversion signals across seller-owned catalog items.
    - group "Analytics date range":
      - button "7 days"
      - button "30 days"
      - button "90 days"
      - button "Custom"
    - text: Start date
    - textbox "Start date": 2026-09-30
    - text: End date
    - textbox "End date": 2026-10-02
    - textbox "Search product analytics":
      - /placeholder: Search product
    - button "Search"
    - paragraph: Views
    - paragraph: "4"
    - paragraph: Add to cart
    - paragraph: "4"
    - paragraph: Orders
    - paragraph: "4"
    - paragraph: Units sold
    - paragraph: "4"
    - paragraph: Revenue
    - paragraph: THB 0.15
    - paragraph: Conversion
    - paragraph: 100%
    - text: Daily trend
    - 'img "Wed Sep 30 2026 07:00:00 GMT+0700 (Indochina Time) views: 1"'
    - 'img "Wed Sep 30 2026 07:00:00 GMT+0700 (Indochina Time) add to cart: 1"'
    - 'img "Wed Sep 30 2026 07:00:00 GMT+0700 (Indochina Time) orders: 1"'
    - text: 09-30T00:00:00.000Z
    - 'img "Thu Oct 01 2026 07:00:00 GMT+0700 (Indochina Time) views: 2"'
    - 'img "Thu Oct 01 2026 07:00:00 GMT+0700 (Indochina Time) add to cart: 2"'
    - 'img "Thu Oct 01 2026 07:00:00 GMT+0700 (Indochina Time) orders: 2"'
    - text: 10-01T00:00:00.000Z
    - 'img "Fri Oct 02 2026 07:00:00 GMT+0700 (Indochina Time) views: 1"'
    - 'img "Fri Oct 02 2026 07:00:00 GMT+0700 (Indochina Time) add to cart: 1"'
    - 'img "Fri Oct 02 2026 07:00:00 GMT+0700 (Indochina Time) orders: 1"'
    - text: 10-02T00:00:00.000Z Top SKUs
    - paragraph: 2a039096-fb5d-49bd-9d4f-cabd2df6ea79
    - paragraph: Extended product 18c26626 / Default
    - paragraph: THB 0.15
    - paragraph: 4 units / 4 orders
    - text: Product performance
    - table:
      - rowgroup:
        - row "Product Sort by Views Sort by Add to cart Sort by Orders Sort by Units Sort by Revenue Sort by Conversion":
          - columnheader "Product"
          - columnheader "Sort by Views":
            - button "Sort by Views": Views
          - columnheader "Sort by Add to cart":
            - button "Sort by Add to cart": Add to cart
          - columnheader "Sort by Orders":
            - button "Sort by Orders": Orders
          - columnheader "Sort by Units":
            - button "Sort by Units": Units
          - columnheader "Sort by Revenue":
            - button "Sort by Revenue": Revenue
          - columnheader "Sort by Conversion":
            - button "Sort by Conversion": Conversion
      - rowgroup:
        - row "Extended product 18c26626 Extended Shop c062ce58 / ACTIVE 4 4 4 4 THB 0.15 100%":
          - cell "Extended product 18c26626 Extended Shop c062ce58 / ACTIVE":
            - link "Extended product 18c26626":
              - /url: /en/seller/products/f4336b6d-ae90-4fa7-b472-61869a6ed081
            - paragraph: Extended Shop c062ce58 / ACTIVE
          - cell "4"
          - cell "4"
          - cell "4"
          - cell "4"
          - cell "THB 0.15"
          - cell "100%"
    - paragraph: Showing 1 of 1 row(s)
    - button "Previous page" [disabled]: Previous
    - text: 1 / 1
    - button "Next page" [disabled]: Next
    - text: Low-performing products No low-performing products in this range.
- region "Notifications alt+T"
- alert: Product Analytics
```

# Test source

```ts
  1   | import { randomUUID } from "node:crypto";
  2   | import { expect, test, type Page } from "@playwright/test";
  3   | import { prisma } from "#server/lib/prisma.ts";
  4   | import en from "../messages/en.json" with { type: "json" };
  5   | import { isolateActorPage } from "./helpers/browser-context";
  6   | import { commerceFixture, loginUi } from "./helpers/commerce-fixtures";
  7   | 
  8   | test.use({ storageState: { cookies: [], origins: [] } });
  9   | test.afterAll(async () => { await prisma.$disconnect(); });
  10  | 
  11  | function dailyResponse(page: Page, from: string, to: string) {
  12  |   return page.waitForResponse(response => {
  13  |     const url = new URL(response.url());
  14  |     return url.pathname === "/api/seller/analytics/products/daily" && url.searchParams.get("range") === "custom"
  15  |       && url.searchParams.get("from") === from && url.searchParams.get("to") === to;
  16  |   });
  17  | }
  18  | 
  19  | test("seller historical daily reports assign midnight17UTC to Bangkok and reconcile selected-day UI API DB cents", async ({ page }, info) => {
  20  |   test.setTimeout(120_000);
  21  |   await isolateActorPage(page);
  22  |   const f = await commerceFixture();
  23  |   const shop = f.shops[0]!;
  24  |   const instants = [
  25  |     { instant: "2026-09-30T16:59:59.999Z", amount: 1n },
  26  |     { instant: "2026-09-30T17:00:00.000Z", amount: 2n },
  27  |     { instant: "2026-10-01T16:59:59.999Z", amount: 4n },
  28  |     { instant: "2026-10-01T17:00:00.000Z", amount: 8n },
  29  |     { instant: "2026-10-31T17:00:00.000Z", amount: 16n },
  30  |   ] as const;
  31  |   const orders = [];
  32  |   for (const { instant, amount } of instants) {
  33  |     const createdAt = new Date(instant);
  34  |     const cart = await prisma.cart.create({ data: { userId: f.buyer.id, status: "CHECKED_OUT" } });
  35  |     const checkout = await prisma.checkout.create({ data: { cartId: cart.id, userId: f.buyer.id, status: "COMPLETED", subtotal: amount, grandTotal: amount, expiresAt: createdAt } });
  36  |     const order = await prisma.order.create({ data: {
  37  |       checkoutId: checkout.id, userId: f.buyer.id, orderNumber: `REPORTING-${randomUUID()}`, status: "PAID", paymentStatus: "SUCCEEDED", subtotal: amount, grandTotal: amount, currency: "THB", createdAt,
  38  |       shippingName: f.buyer.name, shippingLine1: f.address.line1, shippingCity: f.address.city, shippingPostalCode: f.address.postalCode, shippingCountry: f.address.country,
  39  |       items: { create: { shopId: shop.shop.id, variantId: shop.variant.id, quantity: 1, unitPrice: amount, lineTotal: amount, currency: "THB", productTitle: shop.product.title, productSlug: shop.product.slug, variantTitle: shop.variant.title, variantSku: shop.variant.sku, shopName: shop.shop.name, shopSlug: shop.shop.slug } },
  40  |     } });
  41  |     await prisma.shopOrder.create({ data: { orderId: order.id, shopId: shop.shop.id, status: "PAID", subtotal: amount, grandTotal: amount } });
  42  |     await prisma.payment.create({ data: { orderId: order.id, provider: "mock", providerIntentId: randomUUID(), status: "SUCCEEDED", amount, currency: "THB", paidAt: createdAt } });
  43  |     await prisma.productViewLog.create({ data: { productId: shop.product.id, shopId: shop.shop.id, createdAt } });
  44  |     await prisma.productAddToCartLog.create({ data: { productId: shop.product.id, variantId: shop.variant.id, shopId: shop.shop.id, quantity: 3, createdAt } });
  45  |     orders.push(order);
  46  |   }
  47  |   expect(await prisma.orderItem.count({ where: { shopId: shop.shop.id } })).toBe(5);
  48  |   expect(await prisma.orderItem.aggregate({ where: { shopId: shop.shop.id }, _sum: { lineTotal: true } })).toMatchObject({ _sum: { lineTotal: 31n } });
  49  |   const windows = [
  50  |     { date: "2026-09-30", from: "2026-09-29T17:00:00.000Z", to: "2026-09-30T16:59:59.999Z", count: 1, revenue: 1n },
  51  |     { date: "2026-10-01", from: "2026-09-30T17:00:00.000Z", to: "2026-10-01T16:59:59.999Z", count: 2, revenue: 6n },
  52  |     { date: "2026-10-02", from: "2026-10-01T17:00:00.000Z", to: "2026-10-02T16:59:59.999Z", count: 1, revenue: 8n },
  53  |   ] as const;
  54  |   const dbDays = [];
  55  |   for (const day of windows) {
  56  |     const createdAt = { gte: new Date(day.from), lte: new Date(day.to) };
  57  |     const sales = await prisma.orderItem.aggregate({ where: { shopId: shop.shop.id, order: { createdAt, paymentStatus: "SUCCEEDED" } }, _sum: { lineTotal: true, quantity: true }, _count: { _all: true } });
  58  |     const views = await prisma.productViewLog.count({ where: { shopId: shop.shop.id, createdAt } });
  59  |     const addToCart = await prisma.productAddToCartLog.count({ where: { shopId: shop.shop.id, createdAt } });
  60  |     expect(sales).toMatchObject({ _sum: { lineTotal: day.revenue, quantity: day.count }, _count: { _all: day.count } });
  61  |     expect(views).toBe(day.count);
  62  |     expect(addToCart).toBe(day.count);
  63  |     dbDays.push({ date: day.date, sales, views, addToCart });
  64  |   }
  65  |   await loginUi(page, shop.seller, "/en/seller/analytics/products");
  66  |   await expect(page.getByRole("heading", { name: en.seller.analytics.title, exact: true })).toBeVisible();
  67  |   const allDailyResponse = dailyResponse(page, "2026-09-30", "2026-10-02");
  68  |   await page.getByLabel(en.seller.analytics.startDate, { exact: true }).fill("2026-09-30");
  69  |   await page.getByLabel(en.seller.analytics.endDate, { exact: true }).fill("2026-10-02");
  70  |   const allDaily = await allDailyResponse;
  71  |   expect(allDaily.ok(), await allDaily.text()).toBeTruthy();
  72  |   const allDailyApi = await allDaily.json();
  73  |   expect(allDailyApi.items).toEqual([
  74  |     { date: "2026-09-30", views: 1, addToCart: 1, orders: 1, unitsSold: 1, revenue: "1", conversionRate: 1 },
  75  |     { date: "2026-10-01", views: 2, addToCart: 2, orders: 2, unitsSold: 2, revenue: "6", conversionRate: 1 },
  76  |     { date: "2026-10-02", views: 1, addToCart: 1, orders: 1, unitsSold: 1, revenue: "8", conversionRate: 1 },
  77  |   ]);
  78  |   for (const day of windows) {
  79  |     for (const label of [en.seller.analytics.trendViews, en.seller.analytics.trendAddToCart, en.seller.analytics.trendOrders]) {
> 80  |       await expect(page.getByRole("img", { name: `${label.replace("{date}", day.date)}: ${day.count}`, exact: true })).toBeVisible();
      |                                                                                                                        ^ Error: expect(locator).toBeVisible() failed
  81  |     }
  82  |   }
  83  |   const productRow = page.getByRole("row").filter({ hasText: shop.product.title });
  84  |   await expect(productRow).toContainText(/0\.15/);
  85  |   const revenueKpi = page.locator("p").filter({ hasText: /^Revenue$/ }).locator("..");
  86  |   await expect(revenueKpi).toContainText(/0\.15/);
  87  |   const rangeScreenshot = info.outputPath("bangkok-three-day-report.png");
  88  |   await page.screenshot({ path: rangeScreenshot, fullPage: true });
  89  |   await info.attach("bangkok-three-day-report", { path: rangeScreenshot, contentType: "image/png" });
  90  |   const oneDailyResponse = dailyResponse(page, "2026-10-01", "2026-10-01");
  91  |   await page.getByLabel(en.seller.analytics.startDate, { exact: true }).fill("2026-10-01");
  92  |   await page.getByLabel(en.seller.analytics.endDate, { exact: true }).fill("2026-10-01");
  93  |   const oneDaily = await oneDailyResponse;
  94  |   expect(oneDaily.ok(), await oneDaily.text()).toBeTruthy();
  95  |   const oneDailyApi = await oneDaily.json();
  96  |   expect(oneDailyApi.items).toEqual([{ date: "2026-10-01", views: 2, addToCart: 2, orders: 2, unitsSold: 2, revenue: "6", conversionRate: 1 }]);
  97  |   await expect(page.getByRole("img", { name: "2026-10-01 orders: 2", exact: true })).toBeVisible();
  98  |   await expect(page.getByRole("img", { name: "2026-09-30 orders: 1", exact: true })).toHaveCount(0);
  99  |   await expect(page.getByRole("img", { name: "2026-10-02 orders: 1", exact: true })).toHaveCount(0);
  100 |   await expect(productRow).toContainText(/0\.06/);
  101 |   await expect(productRow.getByRole("cell", { name: "100%", exact: true })).toBeVisible();
  102 |   await expect(revenueKpi).toContainText(/0\.06/);
  103 |   const summaryResponse = await page.request.get("/api/seller/analytics/products/summary?range=custom&from=2026-10-01&to=2026-10-01");
  104 |   expect(summaryResponse.ok(), await summaryResponse.text()).toBeTruthy();
  105 |   const summaryApi = await summaryResponse.json();
  106 |   expect(summaryApi).toMatchObject({ views: 2, addToCart: 2, orders: 2, unitsSold: 2, revenue: "6", conversionRate: 1, currency: "THB" });
  107 |   const screenshot = info.outputPath("bangkok-single-day-report.png");
  108 |   await page.screenshot({ path: screenshot, fullPage: true });
  109 |   await info.attach("bangkok-single-day-report", { path: screenshot, contentType: "image/png" });
  110 |   await info.attach("bangkok-reporting-api-db", { body: JSON.stringify({ historicalPaidPrecondition: true, paymentLifecycleVerifiedHere: false, dashboardCurrentDateFrozen: false, dailyChartShowsRevenue: false, instants, windows, orders, dbDays, allDailyApi, oneDailyApi, summaryApi }, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2), contentType: "application/json" });
  111 | });
  112 | 
```