import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { prisma } from '#server/lib/prisma.ts';
import en from '../messages/en.json' with { type: 'json' };
import { commerceFixture, loginUi } from './helpers/commerce-fixtures';
import { isolateActorPage } from './helpers/browser-context';

test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(120_000);
test.beforeEach(async ({ page }) => { await isolateActorPage(page); });
test.afterAll(async () => { await prisma.$disconnect(); });

test('seller percentage input persists 1250 bps and discounts 1999 satang by 249', async ({ page }) => {
  const fixture = await commerceFixture();
  const { seller, shop, variant } = fixture.shops[0]!;
  await prisma.productVariant.update({ where: { id: variant.id }, data: { price: 1999 } });
  await loginUi(page, seller, '/en/seller/promotions');
  const code = `NUM-${randomUUID().slice(0, 8)}`.toUpperCase();
  const form = page.locator('form').filter({ has: page.getByPlaceholder(en.seller.manage.pages.promotions.code, { exact: true }) });
  await form.getByPlaceholder(en.seller.manage.pages.promotions.code, { exact: true }).fill(code);
  await form.getByRole('combobox').click();
  await page.getByRole('option', { name: en.seller.manage.pages.promotions.percent, exact: true }).click();
  await form.getByPlaceholder(en.seller.manage.pages.promotions.percent, { exact: true }).fill('12.50');
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/seller/coupons' && response.request().method() === 'POST');
  await form.getByRole('button', { name: en.seller.manage.pages.promotions.create, exact: true }).click();
  const response = await pending;
  expect(response.ok(), await response.text()).toBeTruthy();
  expect(await response.json()).toMatchObject({ code, discountPercentBps: 1250, discountType: 'PERCENT' });
  const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code } });
  expect(coupon).toMatchObject({ shopId: shop.id, discountPercentBps: 1250, discountType: 'PERCENT' });
  await page.context().clearCookies();
  const cart = await prisma.cart.create({ data: { userId: fixture.buyer.id,
    items: { create: { variantId: variant.id, quantity: 1, unitPrice: 1999 } } }, include: { items: true } });
  await loginUi(page, fixture.buyer, '/en/checkout');
  const quote = await page.request.post('/api/checkout/quote', { data: { cartId: cart.id, cartItemIds: cart.items.map(item => item.id), couponCode: code } });
  expect(quote.ok(), await quote.text()).toBeTruthy();
  expect(await quote.json()).toMatchObject({ subtotal: '1999', discountTotal: '249', grandTotal: '1750' });
});

test('production route composition prevents seller stock below active holds', async ({ page }) => {
  const fixture = await commerceFixture();
  const { seller, variant } = fixture.shops[0]!;
  const cart = await prisma.cart.create({ data: { userId: fixture.buyer.id,
    items: { create: { variantId: variant.id, quantity: 3, unitPrice: 10000 } } }, include: { items: true } });
  await loginUi(page, fixture.buyer, '/en/checkout');
  const quoteResponse = await page.request.post('/api/checkout/quote', { data: { cartId: cart.id, cartItemIds: cart.items.map(item => item.id) } });
  expect(quoteResponse.ok(), await quoteResponse.text()).toBeTruthy();
  const quote = await quoteResponse.json();
  const checkout = await page.request.post('/api/checkout', { data: {
    cartId: cart.id, cartItemIds: cart.items.map(item => item.id), addressId: fixture.address.id, paymentMethod: 'card',
    acceptedQuoteFingerprint: quote.quoteFingerprint, acceptedTaxPolicyRevision: quote.taxPolicyRevision,
  } });
  expect(checkout.ok(), await checkout.text()).toBeTruthy();
  expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 3 });
  await page.context().clearCookies();
  await loginUi(page, seller, '/en/seller/inventory');
  const rejected = await page.request.patch(`/api/seller/variants/${variant.id}/inventory`, {
    data: { quantityOnHand: 2, reason: 'Numeric audit below holds' },
  });
  expect(rejected.status()).toBe(409);
  expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 3 });
  const accepted = await page.request.patch(`/api/seller/variants/${variant.id}/inventory`, {
    data: { quantityOnHand: 3, reason: 'Numeric audit equal holds' },
  });
  expect(accepted.ok(), await accepted.text()).toBeTruthy();
  expect(await accepted.json()).toMatchObject({ quantityOnHand: 3, quantityReserved: 3, availableStock: 0 });
  expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 3, quantityReserved: 3 });
});

test('real flash HTTP create and update preserve decimal satang and reject sub-satang prices', async ({ page }) => {
  const fixture = await commerceFixture();
  await prisma.user.update({ where: { id: fixture.buyer.id }, data: { role: 'ADMIN' } });
  await loginUi(page, fixture.buyer, '/en/admin');
  const campaign = await page.request.post('/api/admin/flash-sales', { data: {
    title: 'Numeric decimal campaign', status: 'SCHEDULED',
    startsAt: new Date(Date.now() + 3_600_000).toISOString(), endsAt: new Date(Date.now() + 7_200_000).toISOString(),
  } });
  expect(campaign.ok(), await campaign.text()).toBeTruthy();
  const sale = await campaign.json();
  const { product, variant } = fixture.shops[0]!;
  const created = await page.request.post(`/api/admin/flash-sales/${sale.id}/items`, { data: {
    productId: product.id, variantId: variant.id, salePriceBaht: 0.29, stockLimit: 3,
  } });
  expect(created.ok(), await created.text()).toBeTruthy();
  const item = await created.json();
  expect((await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } })).salePrice).toBe(29n);
  const updated = await page.request.patch(`/api/admin/flash-sale-items/${item.id}`, { data: { salePriceBaht: 1.15 } });
  expect(updated.ok(), await updated.text()).toBeTruthy();
  expect((await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } })).salePrice).toBe(115n);
  const invalid = await page.request.patch(`/api/admin/flash-sale-items/${item.id}`, { data: { salePriceBaht: 1.001 } });
  expect(invalid.status()).toBe(400);
  expect((await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } })).salePrice).toBe(115n);
});
