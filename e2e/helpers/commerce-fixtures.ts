import { expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { prisma } from '#server/lib/prisma.ts';
import { signPaymentWebhookBody } from '#server/modules/payment/payment.webhook-signature.ts';
import type { PaymentWebhookBody } from '#server/modules/payment/payment.types.ts';
import en from '../../messages/en.json' with { type: 'json' };

export async function commerceFixture(shopCount = 1) {
  const url = new URL(process.env.DATABASE_URL ?? 'http://missing');
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/marketplace_e2e_')) {
    throw new Error('Commerce E2E requires a disposable local marketplace_e2e_* database');
  }
  const password = 'DemoPass123!';
  const passwordHash = await hashPassword(password);
  async function identity(label: string) {
    const user = await prisma.user.create({ data: { name: label, email: `${randomUUID()}@example.test`, emailVerified: true, role: 'USER', status: 'ACTIVE' } });
    await prisma.account.create({ data: { userId: user.id, accountId: user.id, providerId: 'credential', password: passwordHash, issuer: 'local:credential' } });
    return { ...user, password };
  }
  const buyer = await identity('Extended E2E Buyer');
  const address = await prisma.address.create({ data: { userId: buyer.id, recipientName: buyer.name, phone: '+66800000001', line1: '1 Test Road', city: 'Bangkok', postalCode: '10110', country: 'TH', isDefault: true } });
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
  const shops = [];
  for (let i = 0; i < shopCount; i++) {
    const seller = await identity(`Extended Seller ${i + 1}`);
    const profile = await prisma.sellerProfile.create({ data: { userId: seller.id, legalName: seller.name, displayName: seller.name } });
    const shop = await prisma.shop.create({ data: { ownerId: seller.id, sellerProfileId: profile.id, name: `Extended Shop ${randomUUID().slice(0, 8)}`, slug: randomUUID(), status: 'ACTIVE', contactEmail: seller.email, contactPhone: '+66800000002' } });
    const product = await prisma.product.create({ data: { shopId: shop.id, sellerProfileId: profile.id, categoryId: category.id, title: `Extended product ${randomUUID().slice(0, 8)}`, slug: randomUUID(), status: 'ACTIVE' } });
    const variant = await prisma.productVariant.create({ data: { productId: product.id, title: 'Default', sku: randomUUID(), price: 10000, currency: 'THB', status: 'ACTIVE' } });
    await prisma.inventory.create({ data: { variantId: variant.id, quantityOnHand: 10 } });
    shops.push({ seller, shop, product, variant });
  }
  const wallet = await prisma.buyerCoinWallet.create({ data: { userId: buyer.id, balance: 100 } });
  const coupon = await prisma.coupon.create({ data: { code: randomUUID().toUpperCase(), discountType: 'FIXED_AMOUNT', discountValue: 1000 } });
  return { buyer, address, shops, wallet, coupon };
}

export async function loginUi(page: Page, identity: { email: string; password: string }, next: string) {
  await page.goto(`/en/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel(en.auth.email, { exact: true }).fill(identity.email);
  await page.getByLabel(en.auth.password, { exact: true }).fill(identity.password);
  await page.getByRole('button', { name: en.auth.signIn, exact: true }).click();
  await expect(page).toHaveURL(next);
}

export async function prepareCart(page: Page, fixture: Awaited<ReturnType<typeof commerceFixture>>) {
  // The cart is a precondition here; storefront add-to-cart has its own UI journey.
  await prisma.cart.create({ data: { userId: fixture.buyer.id, items: { create: fixture.shops.map(({ variant }) => ({ variantId: variant.id, quantity: 2, unitPrice: 10000 })) } } });
  await loginUi(page, fixture.buyer, '/en/checkout');
  await expect(page.getByRole('button', { name: en.checkout.placeOrder })).toBeEnabled();
}

export async function placeOrderUi(page: Page) {
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/checkout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: en.checkout.placeOrder }).click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBeTruthy();
  const result = await response.json() as { orderId: string; paymentId: string; totalCents: number };
  await expect(page.getByRole('link', { name: en.checkout.viewPaymentStatus })).toBeVisible();
  return result;
}

export async function paymentEvent(page: Page, result: { orderId: string; paymentId: string }, eventType: PaymentWebhookBody['eventType']) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) throw new Error('PAYMENT_WEBHOOK_SECRET required');
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
  const timestamp = new Date();
  const body: PaymentWebhookBody = { provider: payment.provider, providerRef: randomUUID(), paymentId: payment.id, orderId: result.orderId, amount: Number(payment.amount), eventType };
  const response = await page.request.post('/api/payment/webhook', { data: body, headers: { 'x-payment-timestamp': String(Math.floor(timestamp.getTime() / 1000)), 'x-payment-signature': signPaymentWebhookBody(body, secret, timestamp) } });
  expect(response.ok(), await response.text()).toBeTruthy();
}

export async function shipUi(page: Page, orderNumber: string, tracking: string) {
  const row = page.getByRole('row').filter({ hasText: orderNumber });
  await expect(row).toHaveCount(1);
  const labels = en.seller.manage.pages.orders;
  const ship = row.getByRole('button', { name: labels.ship, exact: true });
  await expect(ship).toBeDisabled();
  await row.getByRole('button', { name: labels.markPacked, exact: true }).click();
  await expect(ship).toBeEnabled();
  await row.getByRole('textbox', { name: labels.carrier, exact: true }).fill('E2E Express');
  await row.getByRole('textbox', { name: labels.tracking, exact: true }).fill(tracking);
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/ship') && response.request().method() === 'PATCH');
  await ship.click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect(ship).toBeDisabled();
}
