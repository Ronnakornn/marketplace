# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: numeric-shipping.spec.ts >> seller decimal shipping survives UI, quote and order; physical holds disable flash purchases
- Location: e2e\numeric-shipping.spec.ts:12:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('section').filter({ has: getByRole('heading', { name: 'Held-stock flash 00000000-9c61-4c8d-a640-2d61aab0a462', exact: true }) }).locator('article').filter({ hasText: 'Extended product 0eaa09dc' })
Expected: 1
Received: 0
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for locator('section').filter({ has: getByRole('heading', { name: 'Held-stock flash 00000000-9c61-4c8d-a640-2d61aab0a462', exact: true }) }).locator('article').filter({ hasText: 'Extended product 0eaa09dc' })
    23 × locator resolved to 0 elements
       - unexpected value "0"

```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import { prisma } from '#server/lib/prisma.ts';
  3   | import en from '../messages/en.json' with { type: 'json' };
  4   | import { isolateActorPage, newActorContext } from './helpers/browser-context';
  5   | import { commerceFixture, loginUi, placeOrderUi } from './helpers/commerce-fixtures';
  6   | 
  7   | test.use({ storageState: { cookies: [], origins: [] } });
  8   | test.setTimeout(120_000);
  9   | test.beforeEach(async ({ page }) => { await isolateActorPage(page); });
  10  | test.afterAll(async () => { await prisma.$disconnect(); });
  11  | 
  12  | test('seller decimal shipping survives UI, quote and order; physical holds disable flash purchases', async ({ page, browser, baseURL }, testInfo) => {
  13  |   const fixture = await commerceFixture();
  14  |   const { seller, shop, product, variant } = fixture.shops[0]!;
  15  |   await prisma.shopSetting.create({ data: { shopId: shop.id, shippingFee: 0n } });
  16  |   await loginUi(page, seller, '/en/seller/shop');
  17  |   const shippingInput = page.getByLabel(en.seller.manage.shippingFeeBaht, { exact: true });
  18  |   await expect(shippingInput).toHaveValue('0');
  19  |   await shippingInput.fill('49.95');
  20  |   const settingsPath = `/api/seller/shops/${shop.id}/settings`;
  21  |   const savedResponse = page.waitForResponse(response => new URL(response.url()).pathname === settingsPath && response.request().method() === 'PATCH');
  22  |   await page.getByRole('button', { name: en.seller.manage.saveShippingFee, exact: true }).click();
  23  |   const saved = await savedResponse;
  24  |   expect(saved.request().postDataJSON()).toMatchObject({ shippingFeeBaht: '49.95' });
  25  |   expect(saved.ok(), await saved.text()).toBeTruthy();
  26  |   expect(await saved.json()).toMatchObject({ shopId: shop.id, shippingFeeBaht: 49.95 });
  27  |   expect(await prisma.shopSetting.findUniqueOrThrow({ where: { shopId: shop.id } })).toMatchObject({ shippingFee: 4995n });
  28  |   await expect(page.getByText(en.seller.manage.shippingFeeSaved, { exact: true })).toBeVisible();
  29  | 
  30  |   const invalid = await page.request.patch(settingsPath, { data: { shippingFeeBaht: '49.951' } });
  31  |   expect(invalid.status()).toBe(422);
  32  |   expect(await prisma.shopSetting.findUniqueOrThrow({ where: { shopId: shop.id } })).toMatchObject({ shippingFee: 4995n });
  33  |   const settings = await page.request.get(settingsPath);
  34  |   expect(settings.ok(), await settings.text()).toBeTruthy();
  35  |   expect(await settings.json()).toMatchObject({ shippingFeeBaht: 49.95 });
  36  |   await page.reload();
  37  |   await expect(shippingInput).toHaveValue('49.95');
  38  | 
  39  |   const cart = await prisma.cart.create({ data: { userId: fixture.buyer.id,
  40  |     items: { create: { variantId: variant.id, quantity: 10, unitPrice: 10000n } },
  41  |   }, include: { items: true } });
  42  |   const buyerContext = await newActorContext(browser, { baseURL });
  43  |   let flashSaleId: string | undefined;
  44  |   try {
  45  |     const buyerPage = await buyerContext.newPage();
  46  |     const hydrationErrors: string[] = [];
  47  |     buyerPage.on('pageerror', error => { if (/hydration/i.test(error.message)) hydrationErrors.push(error.message); });
  48  |     buyerPage.on('console', message => { if (message.type() === 'error' && /hydration/i.test(message.text())) hydrationErrors.push(message.text()); });
  49  |     await loginUi(buyerPage, fixture.buyer, '/en/checkout');
  50  |     await expect(buyerPage.getByRole('button', { name: en.checkout.placeOrder, exact: true })).toBeEnabled();
  51  |     await expect(buyerPage.getByText('฿49.95', { exact: true })).toBeVisible();
  52  |     await expect(buyerPage.getByText('฿1,049.95', { exact: true })).toHaveCount(2);
  53  |     const quoteResponse = await buyerPage.request.post('/api/checkout/quote', { data: {
  54  |       cartId: cart.id, cartItemIds: cart.items.map(item => item.id),
  55  |     } });
  56  |     expect(quoteResponse.ok(), await quoteResponse.text()).toBeTruthy();
  57  |     expect(await quoteResponse.json()).toMatchObject({
  58  |       subtotal: '100000', discountTotal: '0', shippingTotal: '4995', taxTotal: '0', grandTotal: '104995',
  59  |       shops: [expect.objectContaining({ shopId: shop.id, subtotal: '100000' })],
  60  |     });
  61  |     const screenshot = testInfo.outputPath('shipping-49-95-checkout.png');
  62  |     await buyerPage.screenshot({ path: screenshot, fullPage: true });
  63  |     await testInfo.attach('exact-shipping-checkout', { path: screenshot, contentType: 'image/png' });
  64  |     const result = await placeOrderUi(buyerPage);
  65  |     expect(result.totalCents).toBe('104995');
  66  |     expect(await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } })).toMatchObject({
  67  |       subtotal: 100000n, shippingTotal: 4995n, grandTotal: 104995n,
  68  |     });
  69  |     expect(await prisma.shopOrder.findFirstOrThrow({ where: { orderId: result.orderId, shopId: shop.id } })).toMatchObject({
  70  |       shippingTotal: 4995n, grandTotal: 104995n,
  71  |     });
  72  |     expect(await prisma.shopSaleSnapshot.findFirstOrThrow({ where: { shopOrder: { orderId: result.orderId, shopId: shop.id } } })).toMatchObject({
  73  |       originalShipping: 4995n, buyerShipping: 4995n,
  74  |     });
  75  |     expect(await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } })).toMatchObject({ amount: 104995n, status: 'PENDING' });
  76  |     expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 10 });
  77  | 
  78  |     const campaign = await prisma.flashSale.create({ data: {
  79  |       title: `Held-stock flash ${shop.id}`, status: 'ACTIVE',
  80  |       startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 120_000),
  81  |       items: { create: { shopId: shop.id, productId: product.id, variantId: variant.id,
  82  |         salePrice: 9000n, originalPrice: 10000n, stockLimit: 20, soldCount: 0, perUserLimit: 10,
  83  |       } },
  84  |     }, include: { items: true } });
  85  |     flashSaleId = campaign.id;
  86  |     const discovery = await buyerPage.request.get('/api/discovery/home?locale=en');
  87  |     expect(discovery.ok(), await discovery.text()).toBeTruthy();
  88  |     expect(await discovery.json()).toMatchObject({ sections: { flashSale: {
  89  |       id: campaign.id, items: [expect.objectContaining({ id: campaign.items[0]!.id,
  90  |         salePrice: '9000', originalPrice: '10000', stockLimit: 20, soldCount: 0, availableStock: 0,
  91  |       })],
  92  |     } } });
  93  |     expect(await prisma.flashSaleReservation.count({ where: { flashSaleItemId: campaign.items[0]!.id } })).toBe(0);
> 94  |     await buyerPage.goto('/en');
      |                        ^ Error: expect(locator).toHaveCount(expected) failed
  95  |     const section = buyerPage.locator('section').filter({ has: buyerPage.getByRole('heading', { name: campaign.title, exact: true }) });
  96  |     const card = section.locator('article').filter({ hasText: product.title });
  97  |     await expect(card).toHaveCount(1);
  98  |     await expect(card.getByText('THB 90.00', { exact: true })).toBeVisible();
  99  |     await expect(card.getByRole('button', { name: en.product.add, exact: true })).toBeDisabled();
  100 |     expect(hydrationErrors).toEqual([]);
  101 |     const heldScreenshot = testInfo.outputPath('flash-physical-stock-held.png');
  102 |     await section.screenshot({ path: heldScreenshot });
  103 |     await testInfo.attach('flash-physical-stock-held', { path: heldScreenshot, contentType: 'image/png' });
  104 |   } finally {
  105 |     if (flashSaleId) await prisma.flashSale.update({ where: { id: flashSaleId }, data: { status: 'ENDED' } });
  106 |     await buyerContext.close();
  107 |   }
  108 | });
  109 | 
```