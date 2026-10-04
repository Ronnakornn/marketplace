import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { prisma } from '#server/lib/prisma.ts';
import en from '../messages/en.json' with { type: 'json' };
import { commerceFixture, loginUi, paymentEvent, placeOrderUi } from './helpers/commerce-fixtures';
import { createFinanceFixture, financeDatabase } from './helpers/finance-fixtures';
import { newActorContext } from './helpers/browser-context';

test.use({ storageState: { cookies: [], origins: [] } });
test.afterAll(async () => { await prisma.$disconnect(); });

for (const scenario of [
  { mode: 'INCLUSIVE', price: 10700n, coupon: 1070n, cash: '8560', included: '630', added: '0', buyerNet: 8000n, buyerTax: 560n, platformNet: 1000n, platformTax: 70n, label: '฿85.60' },
  { mode: 'EXCLUSIVE', price: 10000n, coupon: 1000n, cash: '8630', included: '0', added: '630', buyerNet: 8000n, buyerTax: 630n, platformNet: 1000n, platformTax: 0n, label: '฿86.30' },
] as const) {
  test(`admin configures ${scenario.mode} tax and checkout stacks original shop and platform funding`, async ({ page, browser, baseURL }, testInfo) => {
    test.setTimeout(150_000);
    const db = financeDatabase();
    const adminContext = await newActorContext(browser, { baseURL, storageState: { cookies: [], origins: [] } });
    const admin = await adminContext.newPage();
    let originalPolicy: Record<string, unknown> | undefined;
    try {
      const identities = await createFinanceFixture(db);
      await loginUi(admin, identities.admin, '/en/admin/settings');
      const policyResponse = await admin.request.get('/api/admin/checkout/tax-policy');
      expect(policyResponse.ok(), await policyResponse.text()).toBeTruthy();
      originalPolicy = (await policyResponse.json()).policy;
      const form = admin.locator('section').filter({ has: admin.getByRole('heading', { name: en.admin.taxPolicy.title, exact: true }) });
      await expect(form.getByRole('heading', { name: en.admin.taxPolicy.title, exact: true })).toBeVisible();
      await form.getByLabel(en.admin.taxPolicy.rate, { exact: true }).fill('7');
      await form.getByLabel(en.admin.taxPolicy.mode, { exact: true }).selectOption(scenario.mode);
      await form.getByLabel(en.admin.taxPolicy.basis, { exact: true }).selectOption('SELLER_AFTER_SHOP_COUPON');
      await form.getByLabel(en.admin.taxPolicy.shipping, { exact: true }).uncheck();
      const savedResponse = admin.waitForResponse(r => r.url().endsWith('/api/admin/checkout/tax-policy') && r.request().method() === 'PUT');
      await form.getByRole('button', { name: en.admin.common.save, exact: true }).click();
      const saved = await savedResponse;
      expect(saved.ok(), await saved.text()).toBeTruthy();
      expect(await saved.json()).toMatchObject({ policy: { ratePpm: 70000, mode: scenario.mode, fundingBasis: 'SELLER_AFTER_SHOP_COUPON' }, settlementEnabled: true });
      await expect(form.getByText(en.admin.taxPolicy.saved)).toBeVisible();
      const f = await commerceFixture();
      const shop = f.shops[0]!;
      await prisma.productVariant.update({ where: { id: shop.variant.id }, data: { price: scenario.price } });
      await prisma.shopSetting.create({ data: { shopId: shop.shop.id, shippingFee: 0n } });
      const shopCoupon = await prisma.coupon.create({ data: { shopId: shop.shop.id, code: randomUUID().toUpperCase(), discountType: 'FIXED_AMOUNT', discountValue: scenario.coupon } });
      await prisma.coupon.update({ where: { id: f.coupon.id }, data: { discountValue: scenario.coupon } });
      await prisma.cart.create({ data: { userId: f.buyer.id, items: { create: { variantId: shop.variant.id, quantity: 1, unitPrice: scenario.price } } } });
      await loginUi(page, f.buyer, '/en/checkout');
      await page.getByLabel(en.checkout.shopCoupon, { exact: true }).fill(shopCoupon.code);
      await page.getByRole('button', { name: en.checkout.applyShopCoupon, exact: true }).click();
      await expect(page.getByText(en.checkout.couponApplied.replace('{code}', shopCoupon.code), { exact: true })).toBeVisible();
      await page.getByLabel(en.checkout.platformCoupon, { exact: true }).fill(f.coupon.code);
      const quotedResponse = page.waitForResponse(r => r.url().endsWith('/api/checkout/quote') && r.request().postDataJSON()?.platformCouponCode === f.coupon.code);
      await page.getByRole('button', { name: en.checkout.applyPlatformCoupon, exact: true }).click();
      const quoted = await quotedResponse;
      expect(quoted.ok(), await quoted.text()).toBeTruthy();
      expect(await quoted.json()).toMatchObject({ grandTotal: scenario.cash, taxTotal: scenario.added, includedTaxTotal: scenario.included, reportedTaxTotal: '630' });
      await expect(page.getByText(scenario.label, { exact: true })).toHaveCount(2);
      await expect(page.getByTestId('checkout-tax-disclosure')).toContainText('฿6.30');
      const screenshot = testInfo.outputPath(`tax-${scenario.mode.toLowerCase()}-checkout.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach('original-tax-checkout', { path: screenshot, contentType: 'image/png' });
      const result = await placeOrderUi(page);
      expect(result.totalCents).toBe(scenario.cash);
      const item = await prisma.itemSaleSnapshot.findFirstOrThrow({ where: { orderItem: { orderId: result.orderId } } });
      expect(item).toMatchObject({ buyerMerchandiseNet: scenario.buyerNet, buyerMerchandiseTax: scenario.buyerTax, platformCouponNet: scenario.platformNet, platformCouponTax: scenario.platformTax, originalAffiliateEligibleNet: 8000n });
      expect(await prisma.shopSaleSnapshot.findFirstOrThrow({ where: { shopOrder: { orderId: result.orderId } } })).toMatchObject({ policyVersion: 2, commissionBase: 9000n, originalCommission: 900n });
      expect(await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } })).toMatchObject({ amount: BigInt(scenario.cash), status: 'PENDING' });
      await paymentEvent(page, result, 'payment.paid');
      expect(await prisma.couponRedemption.findMany({ where: { orderId: result.orderId }, select: { couponId: true, status: true } })).toEqual(expect.arrayContaining([
        { couponId: shopCoupon.id, status: 'REDEEMED' }, { couponId: f.coupon.id, status: 'REDEEMED' },
      ]));
      expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: shop.variant.id } })).toMatchObject({ quantityOnHand: 9, quantityReserved: 0 });
      await page.goto(`/en/orders/${result.orderId}`);
      const receipt = await page.request.get(`/api/orders/${result.orderId}`);
      expect(receipt.ok(), await receipt.text()).toBeTruthy();
      expect(await receipt.json()).toMatchObject({ totals: { grandTotal: scenario.cash, taxTotal: scenario.added, includedTaxTotal: scenario.included, reportedTaxTotal: '630' } });
      await expect(page.getByText(en.checkout.taxReported, { exact: true })).toBeVisible();
    } finally {
      if (originalPolicy) {
        const { ratePpm, mode, fundingBasis, taxableShipping, shippingBasis, rounding, custodian, exclusiveTaxFunding } = originalPolicy;
        const restored = await admin.request.put('/api/admin/checkout/tax-policy', { data: { ratePpm, mode, fundingBasis, taxableShipping, shippingBasis, rounding, custodian, exclusiveTaxFunding } });
        expect(restored.ok(), await restored.text()).toBeTruthy();
      }
      await adminContext.close();
      await db.$disconnect();
    }
  });
}
