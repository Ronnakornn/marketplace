import { isolateActorPage, newActorContext } from './helpers/browser-context';
import { expect, test } from '@playwright/test';
import { prisma } from '#server/lib/prisma.ts';
import en from '../messages/en.json' with { type: 'json' };
import { commerceFixture, loginUi, paymentEvent, placeOrderUi, prepareCart, shipUi } from './helpers/commerce-fixtures';

test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(120_000);
test.afterAll(async () => { await prisma.$disconnect(); });

for (const outcome of ['failed', 'expired', 'buyer-cancel'] as const) {
  test(`unpaid ${outcome} returns stock, coupon and coins and shows canceled buyer state`, async ({ page, browser, baseURL }) => {
    const fixture = await commerceFixture();
    await prepareCart(page, fixture);
    await page.getByPlaceholder(en.checkout.couponCode).fill(fixture.coupon.code);
    await page.getByRole('button', { name: en.checkout.couponApply, exact: true }).click();
    await expect(page.getByText(en.checkout.couponApplied.replace('{code}', fixture.coupon.code), { exact: true })).toBeVisible();
    await page.getByRole('spinbutton', { name: en.checkout.coins, exact: true }).fill('10');
    await page.getByRole('button', { name: en.checkout.coinsApply, exact: true }).click();
    await expect(page.getByText(en.checkout.coinsApplied.replace('{count}', '10'), { exact: true })).toBeVisible();
    const result = await placeOrderUi(page);
    expect(await prisma.buyerCoinWallet.findUnique({ where: { id: fixture.wallet.id } })).toMatchObject({ balance: 90, pendingBalance: 10 });
    if (outcome === 'buyer-cancel') {
      await page.goto(`/en/orders/${result.orderId}`);
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: en.order.cancel, exact: true }).click();
    } else {
      await paymentEvent(page, result, outcome === 'failed' ? 'payment.failed' : 'payment.expired');
      await page.goto(`/en/orders/${result.orderId}`);
    }
    await expect(page.getByText(en.order.statuses.canceled, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: en.order.cancel, exact: true })).toHaveCount(0);
    expect(await prisma.inventory.findUnique({ where: { variantId: fixture.shops[0]!.variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 });
    expect(await prisma.buyerCoinWallet.findUnique({ where: { id: fixture.wallet.id } })).toMatchObject({ balance: 100, pendingBalance: 0 });
    expect(await prisma.couponRedemption.findFirst({ where: { orderId: result.orderId } })).toMatchObject({ status: 'RELEASED' });
    expect(await prisma.shopOrder.findFirst({ where: { orderId: result.orderId } })).toMatchObject({ status: 'CANCELED' });
    const sellerContext = await newActorContext(browser, { baseURL, storageState: { cookies: [], origins: [] } });
    try {
      const sellerPage = await sellerContext.newPage();
      await loginUi(sellerPage, fixture.shops[0]!.seller, '/en/seller/orders');
      await expect(sellerPage.getByText(en.seller.manage.pages.orders.empty, { exact: true })).toBeVisible();
      const sellerOrder = await sellerPage.request.get(`/api/seller/orders/${result.orderId}`);
      expect(sellerOrder.ok(), await sellerOrder.text()).toBeTruthy();
      expect(await sellerOrder.json()).toMatchObject({ status: 'CANCELED' });
    } finally { await sellerContext.close(); }
  });
}

test('two sellers ship separately and buyer sees only the tracking each has submitted', async ({ page, browser, baseURL }) => {
  const fixture = await commerceFixture(2);
  await prepareCart(page, fixture);
  const result = await placeOrderUi(page);
  await paymentEvent(page, result, 'payment.paid');
  const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } });
  const tracking = [`A-${order.id}`, `B-${order.id}`];
  for (let i = 0; i < 2; i++) {
    const context = await newActorContext(browser, { baseURL, storageState: { cookies: [], origins: [] } });
    try {
      const sellerPage = await context.newPage();
      await loginUi(sellerPage, fixture.shops[i]!.seller, '/en/seller/orders');
      const row = sellerPage.getByRole('row').filter({ hasText: order.orderNumber });
      await expect(row).toContainText(fixture.shops[i]!.product.title);
      await expect(row).not.toContainText(fixture.shops[1 - i]!.product.title);
      await shipUi(sellerPage, order.orderNumber, tracking[i]!);
      await page.bringToFront();
      await page.goto(`/en/orders/${order.id}/tracking`);
      await expect(page.getByText(`E2E Express ${tracking[i]}`, { exact: true })).toBeVisible();
      if (i === 0) {
        await expect(page.getByText(`E2E Express ${tracking[1]}`, { exact: true })).toHaveCount(0);
        expect(await prisma.order.findUnique({ where: { id: order.id } })).toMatchObject({ status: 'PARTIALLY_FULFILLED' });
      }
    } finally { await context.close(); }
  }
  await expect(page.getByText(`E2E Express ${tracking[0]}`, { exact: true })).toBeVisible();
  expect(await prisma.order.findUnique({ where: { id: order.id } })).toMatchObject({ status: 'SHIPPED' });
});

test('stock disappearing after the quote rejects checkout without leaving an order or reservation', async ({ page }) => {
  const fixture = await commerceFixture();
  await prepareCart(page, fixture);
  await prisma.inventory.update({ where: { variantId: fixture.shops[0]!.variant.id }, data: { quantityOnHand: 0 } });
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/checkout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: en.checkout.placeOrder }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeFalsy();
  const payload = await response.json();
  await expect(page.getByText(payload.error.message, { exact: true })).toBeVisible();
  expect(await prisma.order.count({ where: { userId: fixture.buyer.id } })).toBe(0);
  expect(await prisma.inventory.findUnique({ where: { variantId: fixture.shops[0]!.variant.id } })).toMatchObject({ quantityReserved: 0 });
  expect(await prisma.checkout.count({ where: { userId: fixture.buyer.id } })).toBe(0);
});

test('price changes are requoted and the buyer sees the current server total', async ({ page }) => {
  const fixture = await commerceFixture();
  await prepareCart(page, fixture);
  await prisma.productVariant.update({ where: { id: fixture.shops[0]!.variant.id }, data: { price: 12000 } });
  const quotePromise = page.waitForResponse(response => response.url().includes('/api/checkout/quote') && response.ok());
  await page.reload();
  const quote = await (await quotePromise).json();
  expect(quote).toMatchObject({ grandTotal: 24000 });
  await expect(page.getByText('฿240.00', { exact: true }).first()).toBeVisible();
  const result = await placeOrderUi(page);
  expect(result.totalCents).toBe(24000);
  await page.goto(`/en/orders/${result.orderId}`);
  await expect(page.getByText('฿240.00', { exact: true }).first()).toBeVisible();
});

test('expired session requires login again and cannot read another buyer order or seller resources', async ({ page, browser, baseURL }) => {
  const fixture = await commerceFixture(2);
  await prepareCart(page, fixture);
  const result = await placeOrderUi(page);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } });
  await prisma.session.deleteMany({ where: { userId: fixture.buyer.id } });
  await page.goto(`/en/orders/${order.id}`);
  await expect(page).toHaveURL(/\/en\/login\?/);
  await expect(page.getByRole('heading', { name: order.orderNumber })).toHaveCount(0);
  await loginUi(page, fixture.buyer, `/en/orders/${order.id}`);
  await expect(page.getByRole('heading', { name: order.orderNumber })).toBeVisible();
  const outsider = await commerceFixture();
  const context = await newActorContext(browser, { baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const otherPage = await context.newPage();
    await loginUi(otherPage, outsider.buyer, '/en/cart');
    const forbidden = otherPage.waitForResponse(response => response.url().endsWith(`/api/orders/${order.id}`));
    await otherPage.goto(`/en/orders/${order.id}`);
    expect((await forbidden).status()).toBe(404);
    await expect(otherPage.getByRole('heading', { name: order.orderNumber })).toHaveCount(0);
    await otherPage.goto('/en/admin');
    await expect(otherPage.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
    const denied = await otherPage.request.get(`/api/seller/products/${fixture.shops[0]!.product.id}`);
    expect([403, 404]).toContain(denied.status());
  } finally { await context.close(); }
  const sellerContext = await newActorContext(browser, { baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const otherSeller = await sellerContext.newPage();
    await loginUi(otherSeller, fixture.shops[1]!.seller, '/en/seller/products');
    const productId = fixture.shops[0]!.product.id;
    const forbidden = otherSeller.waitForResponse(response => response.url().endsWith(`/api/seller/products/${productId}`) && response.request().method() === 'GET');
    await otherSeller.goto(`/en/seller/products/${productId}`);
    expect([403, 404]).toContain((await forbidden).status());
    await expect(otherSeller.locator('#product-title')).toHaveCount(0);
  } finally { await sellerContext.close(); }
});

// Each local browser client gets its own production rate-limit bucket.
test.beforeEach(async ({ page }) => { await isolateActorPage(page); });
