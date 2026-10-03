import { expect, test } from '@playwright/test';
import { prisma } from '#server/lib/prisma.ts';
import en from '../messages/en.json' with { type: 'json' };
import { commerceFixture, loginUi, placeOrderUi, prepareCart } from './helpers/commerce-fixtures';
import { isolateActorPage, newActorContext } from './helpers/browser-context';

test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(120_000);
test.beforeEach(async ({ page }) => { await isolateActorPage(page); });
test.afterAll(async () => { await prisma.$disconnect(); });

test('seller price edit invalidates warmed catalog cache and buyer sees current price', async ({ page, browser, baseURL }) => {
  expect(process.env.CACHE_ENABLED, 'Run this acceptance case with cache enabled').toBe('true');
  const fixture = await commerceFixture();
  const { product, variant, seller } = fixture.shops[0]!;
  const detailUrl = `/api/products/${product.slug}?locale=en`;
  // Two real reads warm and exercise the cache before the seller mutation.
  for (let i = 0; i < 2; i += 1) {
    const cached = await page.request.get(detailUrl);
    expect(cached.ok()).toBeTruthy();
    expect((await cached.json()).variants.find((item: { id: string }) => item.id === variant.id).price).toBe(10000);
  }
  await page.goto(`/en/products/${product.slug}`);
  await expect(page.getByRole('heading', { name: product.title, exact: true })).toBeVisible();
  await expect(page.getByText('฿100.00', { exact: true }).first()).toBeVisible();
  const sellerContext = await newActorContext(browser, { baseURL });
  try {
    await loginUi(await sellerContext.newPage(), seller, '/en/seller/products');
    const updated = await sellerContext.request.patch(`/api/seller/products/${product.id}/variants/${variant.id}`, {
      data: { price: 12500 },
    });
    expect(updated.ok(), await updated.text()).toBeTruthy();
    const freshDetail = page.waitForResponse(response => new URL(response.url()).pathname === `/api/products/${product.slug}` && response.ok());
    await page.reload();
    const detail = await (await freshDetail).json();
    expect(detail.variants.find((item: { id: string }) => item.id === variant.id).price).toBe(12500);
    await expect(page.getByText('฿125.00', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('฿100.00', { exact: true })).toHaveCount(0);
  } finally { await sellerContext.close(); }
});

test('shop suspension after quote rejects checkout without an order or stock reservation', async ({ page }) => {
  const fixture = await commerceFixture();
  await prepareCart(page, fixture);
  const { shop, variant } = fixture.shops[0]!;
  // Out-of-band moderation is the precondition; checkout must read current shop status.
  await prisma.shop.update({ where: { id: shop.id }, data: { status: 'SUSPENDED' } });
  const submission = page.waitForResponse(response => new URL(response.url()).pathname === '/api/checkout'
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: en.checkout.placeOrder, exact: true }).click();
  const response = await submission;
  expect(response.status()).toBe(400);
  const payload = await response.json();
  // Production's global security handler sanitizes domain errors; status and rollback remain strict.
  expect(payload.error).toMatchObject(process.env.PLAYWRIGHT_PRODUCTION === 'true'
    ? { code: 'INVALID_REQUEST', message: 'Request failed' }
    : { message: 'Shop is unavailable' });
  await expect(page.getByText(payload.error.message, { exact: true })).toBeVisible();
  expect(await prisma.order.count({ where: { userId: fixture.buyer.id } })).toBe(0);
  expect(await prisma.checkout.count({ where: { userId: fixture.buyer.id } })).toBe(0);
  expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({
    quantityOnHand: 10, quantityReserved: 0,
  });
});

test('stored product markup renders as literal text without executing a script or event handler', async ({ page }) => {
  const fixture = await commerceFixture();
  const { product } = fixture.shops[0]!;
  const title = '<svg id="e2e-xss-title" onload="window.__catalogXss=true">Title</svg>';
  const description = '<script id="e2e-xss-script">window.__catalogXss=true</script><svg id="e2e-xss-description" onload="window.__catalogXss=true">Description</svg>';
  // Explicit legacy/imported-data precondition, before any buyer cache read.
  // The minimal ACTIVE commerce fixture lacks publish-ready media; seller PATCH
  // rejects that readiness condition, which is not evidence of an HTML input policy.
  await prisma.product.update({ where: { id: product.id }, data: { title, description } });
  expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ title, description });
  await page.addInitScript(() => { (window as unknown as Record<string, unknown>).__catalogXss = false; });
  await page.goto(`/en/products/${product.slug}`);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  // No executable nodes: this proves escaping even if CSP would also block execution.
  await expect(page.locator('#e2e-xss-title, #e2e-xss-script, #e2e-xss-description')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__catalogXss)).toBe(false);
});

test('order snapshots survive later address, product and variant edits', async ({ page }) => {
  const fixture = await commerceFixture();
  await prepareCart(page, fixture);
  const result = await placeOrderUi(page);
  const { product, variant } = fixture.shops[0]!;
  // Change live records after the real checkout transaction commits.
  await prisma.address.update({ where: { id: fixture.address.id }, data: {
    recipientName: 'Changed recipient', line1: '999 Changed Road', city: 'Chiang Mai',
  } });
  await prisma.product.update({ where: { id: product.id }, data: { title: 'Changed product title' } });
  await prisma.productVariant.update({ where: { id: variant.id }, data: {
    title: 'Changed variant', sku: `changed-${variant.sku}`, price: 25000,
  } });
  const response = await page.request.get(`/api/orders/${result.orderId}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  const order = await response.json();
  expect(order.shippingAddress).toMatchObject({
    name: fixture.address.recipientName, line1: fixture.address.line1, city: fixture.address.city,
  });
  expect(order.items).toHaveLength(1);
  expect(order.items[0]).toMatchObject({
    productTitle: product.title, variantTitle: variant.title, variantSku: variant.sku,
    quantity: 2, unitPrice: 10000, lineTotal: 20000,
  });
  await page.goto(`/en/orders/${result.orderId}`);
  await expect(page.getByText(product.title, { exact: true })).toBeVisible();
  await expect(page.getByText('Changed product title', { exact: true })).toHaveCount(0);
});
