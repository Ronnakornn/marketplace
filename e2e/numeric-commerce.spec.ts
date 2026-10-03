import { expect, test } from '@playwright/test';
import { prisma } from '#server/lib/prisma.ts';
import { signPaymentWebhookBody } from '#server/modules/payment/payment.webhook-signature.ts';
import type { PaymentWebhookBody } from '#server/modules/payment/payment.types.ts';
import en from '../messages/en.json' with { type: 'json' };
import { isolateActorPage, newActorContext } from './helpers/browser-context';
import { commerceFixture, loginUi, placeOrderUi } from './helpers/commerce-fixtures';

test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(120_000);
test.beforeEach(async ({ page }) => { await isolateActorPage(page); });
test.afterAll(async () => { await prisma.$disconnect(); });

for (const scenario of [
  { name: 'repriced basket', flash: false, discount: false, coins: 0, unitPrice: 1299, firstLine: 2598, subtotal: 4596, discountTotal: 0, grandTotal: 5396, firstShopDiscount: 0, firstShopTotal: 2948, secondShopDiscount: 0, secondShopTotal: 2448, firstLabel: '฿25.98', totalLabel: '฿53.96' },
  { name: 'coupon and coins', flash: false, discount: true, coins: 8, unitPrice: 1299, firstLine: 2598, subtotal: 4596, discountTotal: 1440, grandTotal: 3956, firstShopDiscount: 813, firstShopTotal: 2135, secondShopDiscount: 627, secondShopTotal: 1821, firstLabel: '฿25.98', totalLabel: '฿39.56' },
  { name: 'flash price with coupon and coins', flash: true, discount: true, coins: 7, unitPrice: 900, firstLine: 1800, subtotal: 3798, discountTotal: 1340, grandTotal: 3258, firstShopDiscount: 635, firstShopTotal: 1515, secondShopDiscount: 705, secondShopTotal: 1743, firstLabel: '฿18.00', totalLabel: '฿32.58' },
]) {
  test(`UI, API and database preserve exact satang for ${scenario.name}`, async ({ page, browser, baseURL }) => {
    const fixture = await commerceFixture(2);
    const [first, second] = fixture.shops;
    if (!first || !second) throw new Error('Two-shop fixture required');
    await prisma.productVariant.update({ where: { id: first.variant.id }, data: { price: 1299 } });
    await prisma.productVariant.update({ where: { id: second.variant.id }, data: { price: 999 } });
    await prisma.shopSetting.create({ data: { shopId: first.shop.id, shippingFee: 350 } });
    await prisma.shopSetting.create({ data: { shopId: second.shop.id, shippingFee: 450 } });
    await prisma.coupon.update({ where: { id: fixture.coupon.id }, data: { discountValue: 640 } });
    if (scenario.flash) {
      await prisma.flashSale.create({ data: {
        title: 'Exact satang flash sale', status: 'ACTIVE',
        startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000),
        items: { create: { shopId: first.shop.id, productId: first.product.id, variantId: first.variant.id, salePrice: 900, originalPrice: 1299, stockLimit: 10, perUserLimit: 2 } },
      } });
    }
    const cart = await prisma.cart.create({ data: {
      userId: fixture.buyer.id,
      items: { create: [
        { variantId: first.variant.id, quantity: 2, unitPrice: 10000, createdAt: new Date(Date.now() - 1000) },
        { variantId: second.variant.id, quantity: 2, unitPrice: 10000, createdAt: new Date() },
      ] },
    }, include: { items: true } });
    await loginUi(page, fixture.buyer, '/en/checkout');
    await expect(page.getByRole('button', { name: en.checkout.placeOrder })).toBeEnabled();
    if (scenario.discount) {
      await page.getByPlaceholder(en.checkout.couponCode).fill(fixture.coupon.code);
      await page.getByRole('button', { name: en.checkout.couponApply, exact: true }).click();
      await expect(page.getByText(en.checkout.couponApplied.replace('{code}', fixture.coupon.code), { exact: true })).toBeVisible();
      await page.getByRole('spinbutton', { name: en.checkout.coins, exact: true }).fill(String(scenario.coins));
      await page.getByRole('button', { name: en.checkout.coinsApply, exact: true }).click();
    }
    await expect(page.getByText(scenario.totalLabel, { exact: true })).toHaveCount(2);
    await expect(page.getByText(scenario.firstLabel, { exact: true })).toHaveCount(3);
    await expect(page.getByText('฿19.98', { exact: true })).toHaveCount(3);
    await expect(page.getByText('฿8.00', { exact: true })).toBeVisible();
    await expect(page.getByText('฿200.00', { exact: true })).toHaveCount(0);
    const screenshotName = scenario.flash ? 'flash' : scenario.discount ? 'coupon-coins' : 'repriced';
    await page.screenshot({ path: `docs/test-evidence/2026-10-04-numeric/checkout-${screenshotName}.png`, fullPage: true });
    const quoteResponse = await page.request.post('/api/checkout/quote', { data: {
      cartId: cart.id, cartItemIds: cart.items.map(item => item.id),
      ...(scenario.discount ? { couponCode: fixture.coupon.code, coinsToUse: scenario.coins } : {}),
    } });
    expect(quoteResponse.ok(), await quoteResponse.text()).toBeTruthy();
    const quote = await quoteResponse.json();
    expect(quote).toMatchObject({ subtotal: scenario.subtotal, discountTotal: scenario.discountTotal, shippingTotal: 800, taxTotal: 0, grandTotal: scenario.grandTotal, coinsApplied: scenario.coins });
    expect(quote.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ shopId: first.shop.id, unitPrice: scenario.unitPrice, lineTotal: scenario.firstLine }),
      expect.objectContaining({ shopId: second.shop.id, unitPrice: 999, lineTotal: 1998 }),
    ]));
    const result = await placeOrderUi(page);
    expect(result.totalCents).toBe(scenario.grandTotal);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { items: true, payments: true, shopOrders: true } });
    expect(order).toMatchObject({ subtotal: scenario.subtotal, discountTotal: scenario.discountTotal, shippingTotal: 800, taxTotal: 0, grandTotal: scenario.grandTotal });
    expect(order.payments).toHaveLength(1);
    expect(order.payments[0]).toMatchObject({ amount: scenario.grandTotal, status: 'PENDING' });
    expect(order.items).toHaveLength(2);
    expect(order.items.find(item => item.shopId === first.shop.id)).toMatchObject({ unitPrice: scenario.unitPrice, quantity: 2, lineTotal: scenario.firstLine });
    expect(order.items.find(item => item.shopId === second.shop.id)).toMatchObject({ unitPrice: 999, quantity: 2, lineTotal: 1998 });
    expect(order.shopOrders.find(shop => shop.shopId === first.shop.id)).toMatchObject({ subtotal: scenario.firstLine, discountTotal: scenario.firstShopDiscount, shippingTotal: 350, grandTotal: scenario.firstShopTotal });
    expect(order.shopOrders.find(shop => shop.shopId === second.shop.id)).toMatchObject({ subtotal: 1998, discountTotal: scenario.secondShopDiscount, shippingTotal: 450, grandTotal: scenario.secondShopTotal });
    for (const { variant } of fixture.shops) {
      expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 2 });
    }
    if (scenario.discount) {
      expect(await prisma.buyerCoinWallet.findUniqueOrThrow({ where: { id: fixture.wallet.id } })).toMatchObject({ balance: scenario.coins === 8 ? 92 : 93, pendingBalance: scenario.coins });
    }
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) throw new Error('PAYMENT_WEBHOOK_SECRET required');
    const timestamp = new Date();
    const webhook: PaymentWebhookBody = {
      provider: 'mock', providerRef: `numeric-${screenshotName}-${result.paymentId}`,
      paymentId: result.paymentId, orderId: result.orderId,
      amount: scenario.grandTotal, eventType: 'payment.paid',
    };
    const postWebhook = (body: PaymentWebhookBody) => page.request.post('/api/payment/webhook', {
      data: body, headers: {
        'x-payment-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
        'x-payment-signature': signPaymentWebhookBody(body, secret, timestamp),
      },
    });
    const rejected = await postWebhook({ ...webhook, amount: scenario.grandTotal - 1 });
    expect(rejected.status()).toBe(400);
    expect(await rejected.json()).toMatchObject({ error: {
      code: 'INVALID_REQUEST', message: 'Webhook amount does not match payment amount',
    } });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } })).toMatchObject({ amount: scenario.grandTotal, status: 'PENDING' });
    for (const { variant } of fixture.shops) {
      expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 2 });
    }
    const paid = await postWebhook(webhook);
    expect(paid.ok(), await paid.text()).toBeTruthy();
    const replay = await postWebhook(webhook);
    expect(replay.ok(), await replay.text()).toBeTruthy();
    expect(await replay.json()).toEqual({ ok: true, code: 'WEBHOOK_ALREADY_PROCESSED' });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } })).toMatchObject({ amount: scenario.grandTotal, status: 'SUCCEEDED' });
    for (const { variant } of fixture.shops) {
      expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 8, quantityReserved: 0 });
    }
    expect(await prisma.shipment.count({ where: { orderId: result.orderId } })).toBe(2);
    if (scenario.discount) {
      expect(await prisma.couponRedemption.findFirstOrThrow({ where: { orderId: result.orderId } })).toMatchObject({ status: 'REDEEMED' });
      expect(await prisma.buyerCoinLedger.findFirstOrThrow({ where: { orderId: result.orderId, type: 'SPENT' } })).toMatchObject({ status: 'USED', amount: scenario.coins });
      expect(await prisma.buyerCoinWallet.findUniqueOrThrow({ where: { id: fixture.wallet.id } })).toMatchObject({ pendingBalance: 0 });
    }
    for (const seller of [
      { identity: first.seller, shopId: first.shop.id, subtotal: scenario.firstLine, discountTotal: scenario.firstShopDiscount, shippingTotal: 350, grandTotal: scenario.firstShopTotal },
      { identity: second.seller, shopId: second.shop.id, subtotal: 1998, discountTotal: scenario.secondShopDiscount, shippingTotal: 450, grandTotal: scenario.secondShopTotal },
    ]) {
      const context = await newActorContext(browser, { baseURL, storageState: { cookies: [], origins: [] } });
      try {
        const sellerPage = await context.newPage();
        await loginUi(sellerPage, seller.identity, '/en/seller/orders');
        const sellerResponse = await sellerPage.request.get(`/api/seller/orders/${result.orderId}`);
        expect(sellerResponse.ok(), await sellerResponse.text()).toBeTruthy();
        const sellerOrder = await sellerResponse.json();
        expect(sellerOrder.totals).toEqual({
          subtotal: seller.subtotal, discountTotal: seller.discountTotal, shippingTotal: seller.shippingTotal,
          taxTotal: 0, grandTotal: seller.grandTotal, currency: 'THB',
        });
        expect(sellerOrder.items).toEqual([expect.objectContaining({ shopId: seller.shopId, quantity: 2, lineTotal: seller.subtotal })]);
        expect(sellerOrder.shops).toHaveLength(1);
      } finally { await context.close(); }
    }
    await page.goto(`/en/orders/${result.orderId}`);
    await page.reload();
    await expect(page.getByText(scenario.totalLabel, { exact: true }).first()).toBeVisible();
  });
}
