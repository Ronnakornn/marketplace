import { expect, test } from '@playwright/test';
import { prisma } from '#server/lib/prisma.ts';
import en from '../messages/en.json' with { type: 'json' };
import { isolateActorPage, newActorContext } from './helpers/browser-context';
import { commerceFixture, loginUi, placeOrderUi } from './helpers/commerce-fixtures';

test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(120_000);
test.beforeEach(async ({ page }) => { await isolateActorPage(page); });
test.afterAll(async () => { await prisma.$disconnect(); });

test('seller decimal shipping survives UI, quote and order; physical holds disable flash purchases', async ({ page, browser, baseURL }, testInfo) => {
  const fixture = await commerceFixture();
  const { seller, shop, product, variant } = fixture.shops[0]!;
  await prisma.shopSetting.create({ data: { shopId: shop.id, shippingFee: 0n } });
  await loginUi(page, seller, '/en/seller/shop');
  const shippingInput = page.getByLabel(en.seller.manage.shippingFeeBaht, { exact: true });
  await expect(shippingInput).toHaveValue('0');
  await shippingInput.fill('49.95');
  const settingsPath = `/api/seller/shops/${shop.id}/settings`;
  const savedResponse = page.waitForResponse(response => new URL(response.url()).pathname === settingsPath && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: en.seller.manage.saveShippingFee, exact: true }).click();
  const saved = await savedResponse;
  expect(saved.request().postDataJSON()).toMatchObject({ shippingFeeBaht: '49.95' });
  expect(saved.ok(), await saved.text()).toBeTruthy();
  expect(await saved.json()).toMatchObject({ shopId: shop.id, shippingFeeBaht: 49.95 });
  expect(await prisma.shopSetting.findUniqueOrThrow({ where: { shopId: shop.id } })).toMatchObject({ shippingFee: 4995n });
  await expect(page.getByText(en.seller.manage.shippingFeeSaved, { exact: true })).toBeVisible();

  const invalid = await page.request.patch(settingsPath, { data: { shippingFeeBaht: '49.951' } });
  expect(invalid.status()).toBe(422);
  expect(await prisma.shopSetting.findUniqueOrThrow({ where: { shopId: shop.id } })).toMatchObject({ shippingFee: 4995n });
  const settings = await page.request.get(settingsPath);
  expect(settings.ok(), await settings.text()).toBeTruthy();
  expect(await settings.json()).toMatchObject({ shippingFeeBaht: 49.95 });
  await page.reload();
  await expect(shippingInput).toHaveValue('49.95');

  const cart = await prisma.cart.create({ data: { userId: fixture.buyer.id,
    items: { create: { variantId: variant.id, quantity: 10, unitPrice: 10000n } },
  }, include: { items: true } });
  const buyerContext = await newActorContext(browser, { baseURL });
  let flashSaleId: string | undefined;
  try {
    const buyerPage = await buyerContext.newPage();
    const hydrationErrors: string[] = [];
    buyerPage.on('pageerror', error => { if (/hydration/i.test(error.message)) hydrationErrors.push(error.message); });
    buyerPage.on('console', message => { if (message.type() === 'error' && /hydration/i.test(message.text())) hydrationErrors.push(message.text()); });
    await loginUi(buyerPage, fixture.buyer, '/en/checkout');
    await expect(buyerPage.getByRole('button', { name: en.checkout.placeOrder, exact: true })).toBeEnabled();
    await expect(buyerPage.getByText('฿49.95', { exact: true })).toBeVisible();
    await expect(buyerPage.getByText('฿1,049.95', { exact: true })).toHaveCount(2);
    const quoteResponse = await buyerPage.request.post('/api/checkout/quote', { data: {
      cartId: cart.id, cartItemIds: cart.items.map(item => item.id),
    } });
    expect(quoteResponse.ok(), await quoteResponse.text()).toBeTruthy();
    expect(await quoteResponse.json()).toMatchObject({
      subtotal: '100000', discountTotal: '0', shippingTotal: '4995', taxTotal: '0', grandTotal: '104995',
      shops: [expect.objectContaining({ shopId: shop.id, subtotal: '100000' })],
    });
    const screenshot = testInfo.outputPath('shipping-49-95-checkout.png');
    await buyerPage.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach('exact-shipping-checkout', { path: screenshot, contentType: 'image/png' });
    const result = await placeOrderUi(buyerPage);
    expect(result.totalCents).toBe('104995');
    expect(await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } })).toMatchObject({
      subtotal: 100000n, shippingTotal: 4995n, grandTotal: 104995n,
    });
    expect(await prisma.shopOrder.findFirstOrThrow({ where: { orderId: result.orderId, shopId: shop.id } })).toMatchObject({
      shippingTotal: 4995n, grandTotal: 104995n,
    });
    expect(await prisma.shopSaleSnapshot.findFirstOrThrow({ where: { shopOrder: { orderId: result.orderId, shopId: shop.id } } })).toMatchObject({
      originalShipping: 4995n, buyerShipping: 4995n,
    });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } })).toMatchObject({ amount: 104995n, status: 'PENDING' });
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 10 });

    const campaign = await prisma.flashSale.create({ data: {
      title: `Held-stock flash ${shop.id}`, status: 'ACTIVE',
      startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 120_000),
      items: { create: { shopId: shop.id, productId: product.id, variantId: variant.id,
        salePrice: 9000n, originalPrice: 10000n, stockLimit: 20, soldCount: 0, perUserLimit: 10,
      } },
    }, include: { items: true } });
    flashSaleId = campaign.id;
    const discovery = await buyerPage.request.get('/api/discovery/home?locale=en');
    expect(discovery.ok(), await discovery.text()).toBeTruthy();
    expect(await discovery.json()).toMatchObject({ sections: { flashSale: {
      id: campaign.id, items: [expect.objectContaining({ id: campaign.items[0]!.id,
        salePrice: '9000', originalPrice: '10000', stockLimit: 20, soldCount: 0, availableStock: 0,
      })],
    } } });
    expect(await prisma.flashSaleReservation.count({ where: { flashSaleItemId: campaign.items[0]!.id } })).toBe(0);
    await buyerPage.goto('/en');
    const section = buyerPage.locator('section').filter({ has: buyerPage.getByRole('heading', { name: campaign.title, exact: true }) });
    const card = section.locator('article').filter({ hasText: product.title });
    await expect(card).toHaveCount(1);
    await expect(card.getByText('THB 90.00', { exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: en.product.add, exact: true })).toBeDisabled();
    expect(hydrationErrors).toEqual([]);
    const heldScreenshot = testInfo.outputPath('flash-physical-stock-held.png');
    await section.screenshot({ path: heldScreenshot });
    await testInfo.attach('flash-physical-stock-held', { path: heldScreenshot, contentType: 'image/png' });
  } finally {
    if (flashSaleId) await prisma.flashSale.update({ where: { id: flashSaleId }, data: { status: 'ENDED' } });
    await buyerContext.close();
  }
});
