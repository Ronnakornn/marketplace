# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: numeric-shipping.spec.ts >> seller decimal shipping survives UI, quote and order; physical holds disable flash purchases
- Location: e2e\numeric-shipping.spec.ts:12:1

# Error details

```
Error: expect(received).toMatchObject(expected)

- Expected  - 3
+ Received  + 2

  Object {
    "discountTotal": "0",
    "grandTotal": "104995",
    "shippingTotal": "4995",
    "shops": Array [
-     ObjectContaining {
-       "grandTotal": "104995",
-       "shippingTotal": "4995",
+     Object {
        "shopId": "00000000-0c8b-44c6-ac82-52b5cc880e8b",
+       "subtotal": "100000",
      },
    ],
    "subtotal": "100000",
    "taxTotal": "0",
  }
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
  46  |     await loginUi(buyerPage, fixture.buyer, '/en/checkout');
  47  |     await expect(buyerPage.getByRole('button', { name: en.checkout.placeOrder, exact: true })).toBeEnabled();
  48  |     await expect(buyerPage.getByText('฿49.95', { exact: true })).toBeVisible();
  49  |     await expect(buyerPage.getByText('฿1,049.95', { exact: true })).toHaveCount(2);
  50  |     const quoteResponse = await buyerPage.request.post('/api/checkout/quote', { data: {
  51  |       cartId: cart.id, cartItemIds: cart.items.map(item => item.id),
  52  |     } });
  53  |     expect(quoteResponse.ok(), await quoteResponse.text()).toBeTruthy();
> 54  |     expect(await quoteResponse.json()).toMatchObject({
      |                                        ^ Error: expect(received).toMatchObject(expected)
  55  |       subtotal: '100000', discountTotal: '0', shippingTotal: '4995', taxTotal: '0', grandTotal: '104995',
  56  |       shops: [expect.objectContaining({ shopId: shop.id, shippingTotal: '4995', grandTotal: '104995' })],
  57  |     });
  58  |     const screenshot = testInfo.outputPath('shipping-49-95-checkout.png');
  59  |     await buyerPage.screenshot({ path: screenshot, fullPage: true });
  60  |     await testInfo.attach('exact-shipping-checkout', { path: screenshot, contentType: 'image/png' });
  61  |     const result = await placeOrderUi(buyerPage);
  62  |     expect(result.totalCents).toBe('104995');
  63  |     expect(await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } })).toMatchObject({
  64  |       subtotal: 100000n, shippingTotal: 4995n, grandTotal: 104995n,
  65  |     });
  66  |     expect(await prisma.shopOrder.findFirstOrThrow({ where: { orderId: result.orderId, shopId: shop.id } })).toMatchObject({
  67  |       shippingTotal: 4995n, grandTotal: 104995n,
  68  |     });
  69  |     expect(await prisma.shopSaleSnapshot.findFirstOrThrow({ where: { shopOrder: { orderId: result.orderId, shopId: shop.id } } })).toMatchObject({
  70  |       originalShipping: 4995n, buyerShipping: 4995n,
  71  |     });
  72  |     expect(await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } })).toMatchObject({ amount: 104995n, status: 'PENDING' });
  73  |     expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 10 });
  74  | 
  75  |     const campaign = await prisma.flashSale.create({ data: {
  76  |       title: `Held-stock flash ${shop.id}`, status: 'ACTIVE',
  77  |       startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 120_000),
  78  |       items: { create: { shopId: shop.id, productId: product.id, variantId: variant.id,
  79  |         salePrice: 9000n, originalPrice: 10000n, stockLimit: 20, soldCount: 0, perUserLimit: 10,
  80  |       } },
  81  |     }, include: { items: true } });
  82  |     flashSaleId = campaign.id;
  83  |     const discovery = await buyerPage.request.get('/api/discovery/home?locale=en');
  84  |     expect(discovery.ok(), await discovery.text()).toBeTruthy();
  85  |     expect(await discovery.json()).toMatchObject({ sections: { flashSale: {
  86  |       id: campaign.id, items: [expect.objectContaining({ id: campaign.items[0]!.id,
  87  |         salePrice: '9000', originalPrice: '10000', stockLimit: 20, soldCount: 0, availableStock: 0,
  88  |       })],
  89  |     } } });
  90  |     expect(await prisma.flashSaleReservation.count({ where: { flashSaleItemId: campaign.items[0]!.id } })).toBe(0);
  91  |     await buyerPage.goto('/en');
  92  |     const section = buyerPage.locator('section').filter({ has: buyerPage.getByRole('heading', { name: campaign.title, exact: true }) });
  93  |     const card = section.locator('article').filter({ hasText: product.title });
  94  |     await expect(card).toHaveCount(1);
  95  |     await expect(card.getByText('฿90.00', { exact: true })).toBeVisible();
  96  |     await expect(card.getByRole('button', { name: en.product.add, exact: true })).toBeDisabled();
  97  |     const heldScreenshot = testInfo.outputPath('flash-physical-stock-held.png');
  98  |     await section.screenshot({ path: heldScreenshot });
  99  |     await testInfo.attach('flash-physical-stock-held', { path: heldScreenshot, contentType: 'image/png' });
  100 |   } finally {
  101 |     if (flashSaleId) await prisma.flashSale.update({ where: { id: flashSaleId }, data: { status: 'ENDED' } });
  102 |     await buyerContext.close();
  103 |   }
  104 | });
  105 | 
```