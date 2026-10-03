# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: numeric-boundaries.spec.ts >> seller percentage input persists 1250 bps and discounts 1999 satang by 249
- Location: e2e\numeric-boundaries.spec.ts:13:1

# Error details

```
Error: expect(received).toMatchObject(expected)

- Expected  - 1
+ Received  + 1

  Object {
-   "code": "NUM-d1347a38",
+   "code": "NUM-D1347A38",
    "discountPercentBps": 1250,
    "discountType": "PERCENT",
  }
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { randomUUID } from 'node:crypto';
  3  | import { prisma } from '#server/lib/prisma.ts';
  4  | import en from '../messages/en.json' with { type: 'json' };
  5  | import { commerceFixture, loginUi } from './helpers/commerce-fixtures';
  6  | import { isolateActorPage } from './helpers/browser-context';
  7  | 
  8  | test.use({ storageState: { cookies: [], origins: [] } });
  9  | test.setTimeout(120_000);
  10 | test.beforeEach(async ({ page }) => { await isolateActorPage(page); });
  11 | test.afterAll(async () => { await prisma.$disconnect(); });
  12 | 
  13 | test('seller percentage input persists 1250 bps and discounts 1999 satang by 249', async ({ page }) => {
  14 |   const fixture = await commerceFixture();
  15 |   const { seller, shop, variant } = fixture.shops[0]!;
  16 |   await prisma.productVariant.update({ where: { id: variant.id }, data: { price: 1999 } });
  17 |   await loginUi(page, seller, '/en/seller/promotions');
  18 |   const code = `NUM-${randomUUID().slice(0, 8)}`;
  19 |   const form = page.locator('form').filter({ has: page.getByPlaceholder(en.seller.manage.pages.promotions.code, { exact: true }) });
  20 |   await form.getByPlaceholder(en.seller.manage.pages.promotions.code, { exact: true }).fill(code);
  21 |   await form.getByRole('combobox').click();
  22 |   await page.getByRole('option', { name: en.seller.manage.pages.promotions.percent, exact: true }).click();
  23 |   await form.getByPlaceholder(en.seller.manage.pages.promotions.percent, { exact: true }).fill('12.50');
  24 |   const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/seller/coupons' && response.request().method() === 'POST');
  25 |   await form.getByRole('button', { name: en.seller.manage.pages.promotions.create, exact: true }).click();
  26 |   const response = await pending;
  27 |   expect(response.ok(), await response.text()).toBeTruthy();
> 28 |   expect(await response.json()).toMatchObject({ code, discountPercentBps: 1250, discountType: 'PERCENT' });
     |                                 ^ Error: expect(received).toMatchObject(expected)
  29 |   const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code } });
  30 |   expect(coupon).toMatchObject({ shopId: shop.id, discountPercentBps: 1250, discountType: 'PERCENT' });
  31 |   await page.context().clearCookies();
  32 |   const cart = await prisma.cart.create({ data: { userId: fixture.buyer.id,
  33 |     items: { create: { variantId: variant.id, quantity: 1, unitPrice: 1999 } } } });
  34 |   await loginUi(page, fixture.buyer, '/en/checkout');
  35 |   const quote = await page.request.post('/api/checkout/quote', { data: { cartId: cart.id, couponCode: code } });
  36 |   expect(quote.ok(), await quote.text()).toBeTruthy();
  37 |   expect(await quote.json()).toMatchObject({ subtotal: 1999, discountTotal: 249, grandTotal: 1750 });
  38 | });
  39 | 
  40 | test('production route composition prevents seller stock below active holds', async ({ page }) => {
  41 |   const fixture = await commerceFixture();
  42 |   const { seller, variant } = fixture.shops[0]!;
  43 |   await prisma.inventory.update({ where: { variantId: variant.id }, data: { quantityReserved: 3 } });
  44 |   await loginUi(page, seller, '/en/seller/inventory');
  45 |   const rejected = await page.request.patch(`/api/seller/variants/${variant.id}/inventory`, {
  46 |     data: { quantityOnHand: 2, reason: 'Numeric audit below holds' },
  47 |   });
  48 |   expect(rejected.status()).toBe(409);
  49 |   expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 3 });
  50 |   const accepted = await page.request.patch(`/api/seller/variants/${variant.id}/inventory`, {
  51 |     data: { quantityOnHand: 3, reason: 'Numeric audit equal holds' },
  52 |   });
  53 |   expect(accepted.ok(), await accepted.text()).toBeTruthy();
  54 |   expect(await accepted.json()).toMatchObject({ quantityOnHand: 3, quantityReserved: 3, availableStock: 0 });
  55 |   expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 3, quantityReserved: 3 });
  56 | });
  57 | 
  58 | test('real flash HTTP create and update preserve decimal satang and reject sub-satang prices', async ({ page }) => {
  59 |   const fixture = await commerceFixture();
  60 |   await prisma.user.update({ where: { id: fixture.buyer.id }, data: { role: 'ADMIN' } });
  61 |   await loginUi(page, fixture.buyer, '/en/admin');
  62 |   const campaign = await page.request.post('/api/admin/flash-sales', { data: {
  63 |     title: 'Numeric decimal campaign', status: 'SCHEDULED',
  64 |     startsAt: new Date(Date.now() + 3_600_000).toISOString(), endsAt: new Date(Date.now() + 7_200_000).toISOString(),
  65 |   } });
  66 |   expect(campaign.ok(), await campaign.text()).toBeTruthy();
  67 |   const sale = await campaign.json();
  68 |   const { product, variant } = fixture.shops[0]!;
  69 |   const created = await page.request.post(`/api/admin/flash-sales/${sale.id}/items`, { data: {
  70 |     productId: product.id, variantId: variant.id, salePriceBaht: 0.29, stockLimit: 3,
  71 |   } });
  72 |   expect(created.ok(), await created.text()).toBeTruthy();
  73 |   const item = await created.json();
  74 |   expect(Number((await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } })).salePrice)).toBe(29);
  75 |   const updated = await page.request.patch(`/api/admin/flash-sale-items/${item.id}`, { data: { salePriceBaht: 1.15 } });
  76 |   expect(updated.ok(), await updated.text()).toBeTruthy();
  77 |   expect(Number((await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } })).salePrice)).toBe(115);
  78 |   const invalid = await page.request.patch(`/api/admin/flash-sale-items/${item.id}`, { data: { salePriceBaht: 1.001 } });
  79 |   expect(invalid.status()).toBe(400);
  80 |   expect(Number((await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } })).salePrice)).toBe(115);
  81 | });
  82 | 
```