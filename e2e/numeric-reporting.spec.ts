import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { prisma } from "#server/lib/prisma.ts";
import en from "../messages/en.json" with { type: "json" };
import { isolateActorPage } from "./helpers/browser-context";
import { commerceFixture, loginUi } from "./helpers/commerce-fixtures";

test.use({ storageState: { cookies: [], origins: [] } });
test.afterAll(async () => { await prisma.$disconnect(); });

function dailyResponse(page: Page, from: string, to: string) {
  return page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/seller/analytics/products/daily" && url.searchParams.get("range") === "custom"
      && url.searchParams.get("from") === from && url.searchParams.get("to") === to;
  });
}

test("seller historical daily reports assign midnight17UTC to Bangkok and reconcile selected-day UI API DB cents", async ({ page }, info) => {
  test.setTimeout(120_000);
  await isolateActorPage(page);
  const f = await commerceFixture();
  const shop = f.shops[0]!;
  const instants = [
    { instant: "2026-09-30T16:59:59.999Z", amount: 1n },
    { instant: "2026-09-30T17:00:00.000Z", amount: 2n },
    { instant: "2026-10-01T16:59:59.999Z", amount: 4n },
    { instant: "2026-10-01T17:00:00.000Z", amount: 8n },
    { instant: "2026-10-31T17:00:00.000Z", amount: 16n },
  ] as const;
  const orders = [];
  for (const { instant, amount } of instants) {
    const createdAt = new Date(instant);
    const cart = await prisma.cart.create({ data: { userId: f.buyer.id, status: "CHECKED_OUT" } });
    const checkout = await prisma.checkout.create({ data: { cartId: cart.id, userId: f.buyer.id, status: "COMPLETED", subtotal: amount, grandTotal: amount, expiresAt: createdAt } });
    const order = await prisma.order.create({ data: {
      checkoutId: checkout.id, userId: f.buyer.id, orderNumber: `REPORTING-${randomUUID()}`, status: "PAID", paymentStatus: "SUCCEEDED", subtotal: amount, grandTotal: amount, currency: "THB", createdAt,
      shippingName: f.buyer.name, shippingLine1: f.address.line1, shippingCity: f.address.city, shippingPostalCode: f.address.postalCode, shippingCountry: f.address.country,
      items: { create: { shopId: shop.shop.id, variantId: shop.variant.id, quantity: 1, unitPrice: amount, lineTotal: amount, currency: "THB", productTitle: shop.product.title, productSlug: shop.product.slug, variantTitle: shop.variant.title, variantSku: shop.variant.sku, shopName: shop.shop.name, shopSlug: shop.shop.slug } },
    } });
    await prisma.shopOrder.create({ data: { orderId: order.id, shopId: shop.shop.id, status: "PAID", subtotal: amount, grandTotal: amount } });
    await prisma.payment.create({ data: { orderId: order.id, provider: "mock", providerIntentId: randomUUID(), status: "SUCCEEDED", amount, currency: "THB", paidAt: createdAt } });
    await prisma.productViewLog.create({ data: { productId: shop.product.id, shopId: shop.shop.id, createdAt } });
    await prisma.productAddToCartLog.create({ data: { productId: shop.product.id, variantId: shop.variant.id, shopId: shop.shop.id, quantity: 3, createdAt } });
    orders.push(order);
  }
  expect(await prisma.orderItem.count({ where: { shopId: shop.shop.id } })).toBe(5);
  expect(await prisma.orderItem.aggregate({ where: { shopId: shop.shop.id }, _sum: { lineTotal: true } })).toMatchObject({ _sum: { lineTotal: 31n } });
  const windows = [
    { date: "2026-09-30", from: "2026-09-29T17:00:00.000Z", to: "2026-09-30T16:59:59.999Z", count: 1, revenue: 1n },
    { date: "2026-10-01", from: "2026-09-30T17:00:00.000Z", to: "2026-10-01T16:59:59.999Z", count: 2, revenue: 6n },
    { date: "2026-10-02", from: "2026-10-01T17:00:00.000Z", to: "2026-10-02T16:59:59.999Z", count: 1, revenue: 8n },
  ] as const;
  const dbDays = [];
  for (const day of windows) {
    const createdAt = { gte: new Date(day.from), lte: new Date(day.to) };
    const sales = await prisma.orderItem.aggregate({ where: { shopId: shop.shop.id, order: { createdAt, paymentStatus: "SUCCEEDED" } }, _sum: { lineTotal: true, quantity: true }, _count: { _all: true } });
    const views = await prisma.productViewLog.count({ where: { shopId: shop.shop.id, createdAt } });
    const addToCart = await prisma.productAddToCartLog.count({ where: { shopId: shop.shop.id, createdAt } });
    expect(sales).toMatchObject({ _sum: { lineTotal: day.revenue, quantity: day.count }, _count: { _all: day.count } });
    expect(views).toBe(day.count);
    expect(addToCart).toBe(day.count);
    dbDays.push({ date: day.date, sales, views, addToCart });
  }
  await loginUi(page, shop.seller, "/en/seller/analytics/products");
  await expect(page.getByRole("heading", { name: en.seller.analytics.title, exact: true })).toBeVisible();
  const allDailyResponse = dailyResponse(page, "2026-09-30", "2026-10-02");
  await page.getByLabel(en.seller.analytics.startDate, { exact: true }).fill("2026-09-30");
  await page.getByLabel(en.seller.analytics.endDate, { exact: true }).fill("2026-10-02");
  const allDaily = await allDailyResponse;
  expect(allDaily.ok(), await allDaily.text()).toBeTruthy();
  const allDailyApi = await allDaily.json();
  expect(allDailyApi.items).toEqual([
    { date: "2026-09-30", views: 1, addToCart: 1, orders: 1, unitsSold: 1, revenue: "1", conversionRate: 1 },
    { date: "2026-10-01", views: 2, addToCart: 2, orders: 2, unitsSold: 2, revenue: "6", conversionRate: 1 },
    { date: "2026-10-02", views: 1, addToCart: 1, orders: 1, unitsSold: 1, revenue: "8", conversionRate: 1 },
  ]);
  for (const day of windows) {
    for (const label of [en.seller.analytics.trendViews, en.seller.analytics.trendAddToCart, en.seller.analytics.trendOrders]) {
      await expect(page.getByRole("img", { name: `${label.replace("{date}", day.date)}: ${day.count}`, exact: true })).toBeVisible();
    }
  }
  const productRow = page.getByRole("row").filter({ hasText: shop.product.title });
  await expect(productRow).toContainText(/0\.15/);
  const revenueKpi = page.locator("p").filter({ hasText: /^Revenue$/ }).locator("..");
  await expect(revenueKpi).toContainText(/0\.15/);
  const rangeScreenshot = info.outputPath("bangkok-three-day-report.png");
  await page.screenshot({ path: rangeScreenshot, fullPage: true });
  await info.attach("bangkok-three-day-report", { path: rangeScreenshot, contentType: "image/png" });
  const oneDailyResponse = dailyResponse(page, "2026-10-01", "2026-10-01");
  await page.getByLabel(en.seller.analytics.startDate, { exact: true }).fill("2026-10-01");
  await page.getByLabel(en.seller.analytics.endDate, { exact: true }).fill("2026-10-01");
  const oneDaily = await oneDailyResponse;
  expect(oneDaily.ok(), await oneDaily.text()).toBeTruthy();
  const oneDailyApi = await oneDaily.json();
  expect(oneDailyApi.items).toEqual([{ date: "2026-10-01", views: 2, addToCart: 2, orders: 2, unitsSold: 2, revenue: "6", conversionRate: 1 }]);
  await expect(page.getByRole("img", { name: "2026-10-01 orders: 2", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "2026-09-30 orders: 1", exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "2026-10-02 orders: 1", exact: true })).toHaveCount(0);
  await expect(productRow).toContainText(/0\.06/);
  await expect(productRow.getByRole("cell", { name: "100%", exact: true })).toBeVisible();
  await expect(revenueKpi).toContainText(/0\.06/);
  const summaryResponse = await page.request.get("/api/seller/analytics/products/summary?range=custom&from=2026-10-01&to=2026-10-01");
  expect(summaryResponse.ok(), await summaryResponse.text()).toBeTruthy();
  const summaryApi = await summaryResponse.json();
  expect(summaryApi).toMatchObject({ views: 2, addToCart: 2, orders: 2, unitsSold: 2, revenue: "6", conversionRate: 1, currency: "THB" });
  const screenshot = info.outputPath("bangkok-single-day-report.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await info.attach("bangkok-single-day-report", { path: screenshot, contentType: "image/png" });
  await info.attach("bangkok-reporting-api-db", { body: JSON.stringify({ historicalPaidPrecondition: true, paymentLifecycleVerifiedHere: false, dashboardCurrentDateFrozen: false, dailyChartShowsRevenue: false, instants, windows, orders, dbDays, allDailyApi, oneDailyApi, summaryApi }, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2), contentType: "application/json" });
});
