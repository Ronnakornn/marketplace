import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { prisma } from '#server/lib/prisma.ts';
import type { AppContext } from '#server/context/app-context.ts';
import { createLogger } from '#server/infrastructure/logging/index.ts';
import { PrismaSupportRepository, type ISupportRepository } from '#server/modules/support/support.repository.ts';
import { SupportService } from '#server/modules/support/support.service.ts';
import { commerceFixture, loginUi, paymentEvent, placeOrderUi, prepareCart } from './helpers/commerce-fixtures';
import { isolateActorPage, newActorContext } from './helpers/browser-context';

type Fixture = Awaited<ReturnType<typeof commerceFixture>>;

test.use({ storageState: { cookies: [], origins: [] } });
test.beforeEach(async ({ page }) => { await isolateActorPage(page); });
test.afterAll(async () => { await prisma.$disconnect(); });

async function actor(browser: Browser, baseURL: string | undefined, contexts: BrowserContext[]) {
  const context = await newActorContext(browser, { baseURL });
  contexts.push(context);
  return context.newPage();
}

async function purchasedOrder(page: Page, fixture: Fixture) {
  await prepareCart(page, fixture);
  const result = await placeOrderUi(page);
  await paymentEvent(page, result, 'payment.paid');
  return prisma.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { items: true } });
}

async function economicFacts(fixture: Fixture, orderId: string) {
  const shopIds = fixture.shops.map(({ shop }) => shop.id);
  const variantIds = fixture.shops.map(({ variant }) => variant.id);
  return Promise.all([
    prisma.order.findMany({ where: { userId: fixture.buyer.id }, orderBy: { id: 'asc' }, include: { items: { orderBy: { id: 'asc' }, include: { saleSnapshot: true } }, shopOrders: { orderBy: { id: 'asc' }, include: { saleSnapshot: true } }, payments: { orderBy: { id: 'asc' } } } }),
    prisma.checkout.findMany({ where: { userId: fixture.buyer.id }, orderBy: { id: 'asc' } }),
    prisma.refund.findMany({ where: { orderId }, orderBy: { id: 'asc' } }),
    prisma.returnRequest.findMany({ where: { orderId }, orderBy: { id: 'asc' }, include: { items: { orderBy: { id: 'asc' } } } }),
    prisma.inventory.findMany({ where: { variantId: { in: variantIds } }, orderBy: { id: 'asc' } }),
    prisma.inventoryReservation.findMany({ where: { orderId }, orderBy: { id: 'asc' } }),
    prisma.shopWallet.findMany({ where: { shopId: { in: shopIds } }, orderBy: { id: 'asc' } }),
    prisma.walletLedgerEntry.findMany({ where: { shopId: { in: shopIds } }, orderBy: { id: 'asc' } }),
    prisma.buyerCoinWallet.findMany({ where: { userId: fixture.buyer.id }, orderBy: { id: 'asc' } }),
    prisma.buyerCoinLedger.findMany({ where: { orderId }, orderBy: { id: 'asc' } }),
  ]);
}

async function createTicketUi(page: Page, input: { subject: string; body: string; orderId?: string; shopId?: string }, locale = 'en') {
  const query = new URLSearchParams();
  if (input.orderId) query.set('orderId', input.orderId);
  if (input.shopId) query.set('shopId', input.shopId);
  if (input.orderId || input.shopId) {
    await page.goto(`/${locale}/support/new?${query}`);
  } else {
    await page.goto(`/${locale}/support`);
    await page.getByRole('link', { name: locale === 'en' ? 'Create ticket' : 'แจ้งปัญหา', exact: true }).click();
  }
  await page.getByLabel(locale === 'en' ? 'Subject' : 'หัวข้อ', { exact: true }).fill(input.subject);
  await page.getByLabel(locale === 'en' ? 'Text evidence' : 'รายละเอียดและหลักฐานข้อความ', { exact: true }).fill(input.body);
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/support/tickets') && response.request().method() === 'POST');
  await page.getByRole('button', { name: locale === 'en' ? 'Create ticket' : 'แจ้งปัญหา', exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(200);
  const ticket = await response.json();
  await expect(page).toHaveURL(`/${locale}/support/${ticket.id}`);
  await expect(page.getByText(input.subject, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(input.body, { exact: true })).toBeVisible();
  return ticket;
}

test('buyer and shop seller converse while private notes and unrelated accounts remain isolated', async ({ page, browser, baseURL }, testInfo) => {
  const fixture = await commerceFixture(2);
  const [ownShop, otherShop] = fixture.shops;
  if (!ownShop || !otherShop) throw new Error('Two shops required');
  const order = await purchasedOrder(page, fixture);
  const before = await economicFacts(fixture, order.id);
  const ticket = await createTicketUi(page, { subject: 'Package issue for this shop', body: 'The packaging was damaged on arrival.', orderId: order.id, shopId: ownShop.shop.id });
  expect(ticket).toMatchObject({ userId: fixture.buyer.id, orderId: order.id, shopId: ownShop.shop.id, status: 'OPEN' });
  const contexts: BrowserContext[] = [];
  try {
    const seller = await actor(browser, baseURL, contexts);
    await loginUi(seller, ownShop.seller, '/en/seller/support');
    await expect(seller.getByRole('link', { name: 'Support and appeals', exact: true })).toBeVisible();
    const sellerTicket = seller.locator(`a[href^="/en/seller/support/${ticket.id}"]`);
    await expect(sellerTicket).toContainText(ticket.subject);
    await sellerTicket.click();
    await seller.getByLabel('Message', { exact: true }).fill('Please share which part of the package was damaged.');
    const replyPromise = seller.waitForResponse(response => response.url().endsWith(`/api/seller/support/tickets/${ticket.id}/messages`) && response.request().method() === 'POST');
    await seller.getByRole('button', { name: 'Send message', exact: true }).click();
    expect((await replyPromise).status()).toBe(200);
    await expect(seller.getByText('Please share which part of the package was damaged.', { exact: true })).toBeVisible();
    const admin = await actor(browser, baseURL, contexts);
    await loginUi(admin, { email: 'admin@example.com', password: 'DemoPass123!' }, '/en/admin/support');
    await expect(admin.getByRole('link', { name: 'Support and appeals', exact: true })).toBeVisible();
    const adminTicket = admin.locator(`a[href="/en/admin/support/${ticket.id}"]`);
    await expect(adminTicket).toContainText(ticket.subject);
    await adminTicket.click();
    await admin.getByLabel('Private note', { exact: true }).fill('INTERNAL ONLY: review seller incident history.');
    const notePromise = admin.waitForResponse(response => response.url().endsWith(`/api/admin/support/tickets/${ticket.id}/notes`) && response.request().method() === 'POST');
    await admin.getByRole('button', { name: 'Add private note', exact: true }).click();
    expect((await notePromise).status()).toBe(200);
    await expect(admin.getByText('INTERNAL ONLY: review seller incident history.', { exact: true })).toBeVisible();
    expect(await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({ status: 'PENDING_CUSTOMER' });
    const publicReply = await page.request.post(`/api/support/tickets/${ticket.id}/messages`, { data: { body: 'The box corner was crushed.' } });
    expect(publicReply.status()).toBe(200);
    for (const [participant, prefix] of [[page, '/api/support'], [seller, '/api/seller/support']] as const) {
      const bodies = [];
      for (let messagePage = 1; messagePage <= 3; messagePage++) {
        const response = await participant.request.get(`${prefix}/tickets/${ticket.id}?page=${messagePage}&limit=1`);
        expect(response.status()).toBe(200);
        const detail = await response.json();
        expect(detail.messages).toMatchObject({ total: 3, page: messagePage, limit: 1 });
        expect(detail.messages.items).toHaveLength(1);
        expect(detail.messages.items[0]).toMatchObject({ isInternal: false });
        bodies.push(detail.messages.items[0].body);
        expect(JSON.stringify(detail)).not.toContain(otherShop.product.title);
        expect(JSON.stringify(detail)).not.toContain(fixture.buyer.email);
        expect(JSON.stringify(detail)).not.toContain(fixture.address.line1);
        expect(detail.ticket).not.toHaveProperty('payments');
      }
      expect(bodies).toEqual(['The packaging was damaged on arrival.', 'Please share which part of the package was damaged.', 'The box corner was crushed.']);
      await participant.reload();
      await expect(participant.getByText('INTERNAL ONLY: review seller incident history.', { exact: true })).toHaveCount(0);
    }
    const adminDetail = await admin.request.get(`/api/admin/support/tickets/${ticket.id}?limit=50`);
    expect((await adminDetail.json()).messages).toMatchObject({ total: 4, items: expect.arrayContaining([expect.objectContaining({ senderType: 'ADMIN', isInternal: true, body: 'INTERNAL ONLY: review seller incident history.' })]) });
    const outsider = await actor(browser, baseURL, contexts);
    await loginUi(outsider, otherShop.seller, '/en/seller/support');
    expect((await outsider.request.get(`/api/seller/support/tickets/${ticket.id}`)).status()).toBe(404);
    expect((await outsider.request.post(`/api/seller/support/tickets/${ticket.id}/messages`, { data: { body: 'Unauthorized shop reply' } })).status()).toBe(404);
    expect((await outsider.request.get(`/api/support/tickets/${ticket.id}`)).status()).toBe(404);
    expect((await outsider.request.get('/api/admin/support/tickets')).status()).toBe(403);
    expect((await page.request.post(`/api/admin/support/tickets/${ticket.id}/notes`, { data: { body: 'Forged administrator note' } })).status()).toBe(403);
    await prisma.shop.update({ where: { id: ownShop.shop.id }, data: { status: 'SUSPENDED' } });
    expect([403, 404]).toContain((await seller.request.get(`/api/seller/support/tickets/${ticket.id}`)).status());
    await prisma.shop.update({ where: { id: ownShop.shop.id }, data: { status: 'ACTIVE' } });
    expect(await economicFacts(fixture, order.id)).toEqual(before);
    await page.screenshot({ path: testInfo.outputPath('buyer-public-conversation.png'), fullPage: true });
  } finally {
    for (const context of contexts) await context.close();
  }
});

test('rejected return appeal is durable under concurrent requests and admin decision has no financial effects', async ({ page, browser, baseURL }, testInfo) => {
  const fixture = await commerceFixture();
  const [shop] = fixture.shops;
  if (!shop) throw new Error('Shop required');
  const order = await purchasedOrder(page, fixture);
  const item = order.items[0];
  if (!item) throw new Error('Order item required');
  const deliveredAt = new Date(Date.now() - 60_000);
  await prisma.order.update({ where: { id: order.id }, data: { status: 'DELIVERED' } });
  await prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { fulfillmentStatus: 'DELIVERED' } });
  await prisma.shopOrder.updateMany({ where: { orderId: order.id }, data: { status: 'DELIVERED', fulfillmentStatus: 'DELIVERED' } });
  await prisma.shipment.updateMany({ where: { orderId: order.id }, data: { status: 'DELIVERED', shippedAt: deliveredAt, deliveredAt } });
  const returnResponse = await page.request.post('/api/returns', { data: { orderId: order.id, orderItemId: item.id, quantity: 1, reason: 'DAMAGED', description: 'Damaged corner with text evidence.' } });
  expect(returnResponse.status(), await returnResponse.text()).toBe(200);
  const request = await returnResponse.json();
  expect((await page.request.post('/api/support/appeals', { data: { returnRequestId: request.id, subject: 'Too early appeal', body: 'Seller has not reviewed yet.' } })).status()).toBe(409);
  const contexts: BrowserContext[] = [];
  try {
    const seller = await actor(browser, baseURL, contexts);
    await loginUi(seller, shop.seller, '/en/seller/returns');
    expect((await seller.request.patch(`/api/seller/returns/${request.id}/reject`)).status()).toBe(200);
    const concurrentReturnResponse = await page.request.post('/api/returns', { data: { orderId: order.id, orderItemId: item.id, quantity: 1, reason: 'DAMAGED', description: 'Separate rejected request for concurrent appeal admission.' } });
    expect(concurrentReturnResponse.status(), await concurrentReturnResponse.text()).toBe(200);
    const concurrentReturn = await concurrentReturnResponse.json();
    expect((await seller.request.patch(`/api/seller/returns/${concurrentReturn.id}/reject`)).status()).toBe(200);
    const before = await economicFacts(fixture, order.id);
    const concurrent = await Promise.all(Array.from({ length: 5 }, () => page.request.post('/api/support/appeals', { data: { returnRequestId: concurrentReturn.id, subject: 'Concurrent appeal admission', body: 'Only one durable case may be created.' } })));
    const concurrentIds = new Set<string>();
    for (const response of concurrent) {
      expect(response.status(), await response.text()).toBe(200);
      concurrentIds.add((await response.json()).id);
    }
    expect(concurrentIds.size).toBe(1);
    const [concurrentTicketId] = concurrentIds;
    if (!concurrentTicketId) throw new Error('Concurrent appeal did not return a ticket');
    expect(await prisma.disputeCase.count({ where: { returnRequestId: concurrentReturn.id } })).toBe(1);
    expect(await prisma.ticketMessage.count({ where: { ticketId: concurrentTicketId } })).toBe(1);
    await page.goto(`/en/orders/${order.id}`);
    await page.getByRole('link', { name: 'Get help with this order', exact: true }).click();
    await expect(page).toHaveURL(`/en/orders/${order.id}/support`);
    await page.getByRole('button', { name: 'Appeal rejected return', exact: true }).click();
    await page.getByLabel('Subject', { exact: true }).fill('Please review the rejected damaged return');
    await page.getByLabel('Text evidence', { exact: true }).fill('The damage was present when the package arrived.');
    const appealPromise = page.waitForResponse(response => response.url().endsWith('/api/support/appeals') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Submit appeal', exact: true }).click();
    const appeal = await appealPromise;
    expect(appeal.status(), await appeal.text()).toBe(200);
    const ticket = await appeal.json();
    await expect(page).toHaveURL(`/en/support/${ticket.id}`);
    const repeated = await Promise.all(Array.from({ length: 5 }, () => page.request.post('/api/support/appeals', { data: { returnRequestId: request.id, subject: 'Retry same rejected return', body: 'Repeated request must recover the original case.' } })));
    for (const response of repeated) {
      expect(response.status(), await response.text()).toBe(200);
      expect((await response.json()).id).toBe(ticket.id);
    }
    expect(await prisma.disputeCase.count({ where: { returnRequestId: request.id } })).toBe(1);
    expect(await prisma.supportTicket.count({ where: { orderId: order.id } })).toBe(2);
    expect(await prisma.ticketMessage.count({ where: { ticketId: ticket.id } })).toBe(1);
    const admin = await actor(browser, baseURL, contexts);
    await loginUi(admin, { email: 'admin@example.com', password: 'DemoPass123!' }, `/en/admin/support/${ticket.id}`);
    const adminIdentity = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' } });
    await test.step('PostgreSQL rolls back decision and ticket updates when SYSTEM persistence fails', async () => {
      const context: AppContext = { logger: createLogger({ level: 'silent', environment: 'test' }), config: { environment: 'test' } };
      let updatedStateObserved = false;
      class FailingSystemMessageRepository extends PrismaSupportRepository {
        override transaction<T>(callback: (repo: ISupportRepository) => Promise<T>): Promise<T> {
          return prisma.$transaction(tx => {
            const repository: ISupportRepository = new PrismaSupportRepository(context, tx);
            const persistMessage = repository.createMessage.bind(repository);
            repository.createMessage = async input => {
              if (input.senderType === 'SYSTEM') {
                expect(await tx.disputeCase.findUniqueOrThrow({ where: { returnRequestId: request.id } })).toMatchObject({ status: 'RESOLVED_BUYER', decision: 'Rollback this decision' });
                expect(await tx.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({ status: 'RESOLVED' });
                updatedStateObserved = true;
                throw new Error('Injected SYSTEM persistence failure');
              }
              return persistMessage(input);
            };
            return callback(repository);
          });
        }
      }
      const beforeDecision = await prisma.disputeCase.findUniqueOrThrow({ where: { returnRequestId: request.id } });
      const beforeTicket = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
      const service = new SupportService(context, new FailingSystemMessageRepository(context, prisma));
      await expect(service.decide(adminIdentity.id, ticket.id, { status: 'RESOLVED_BUYER', decision: 'Rollback this decision' })).rejects.toThrow('Injected SYSTEM persistence failure');
      expect(updatedStateObserved).toBe(true);
      expect(await prisma.disputeCase.findUniqueOrThrow({ where: { returnRequestId: request.id } })).toEqual(beforeDecision);
      expect(await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })).toEqual(beforeTicket);
      expect(await prisma.ticketMessage.count({ where: { ticketId: ticket.id } })).toBe(1);
    });
    expect((await admin.request.patch(`/api/admin/support/tickets/${ticket.id}/dispute`, { data: { status: 'RESOLVED_BUYER', decision: '   ' } })).status()).toBe(400);
    await admin.getByLabel('Dispute status', { exact: true }).selectOption('RESOLVED_BUYER');
    await admin.getByLabel('Decision', { exact: true }).fill('Buyer evidence accepted. Refund requires a separate authorized finance process.');
    const decisionPromise = admin.waitForResponse(response => response.url().endsWith(`/api/admin/support/tickets/${ticket.id}/dispute`) && response.request().method() === 'PATCH');
    await admin.getByRole('button', { name: 'Save decision', exact: true }).click();
    expect((await decisionPromise).status()).toBe(200);
    const persisted = await prisma.disputeCase.findUniqueOrThrow({ where: { returnRequestId: request.id } });
    expect(persisted).toMatchObject({ ticketId: ticket.id, orderId: order.id, openedById: fixture.buyer.id, status: 'RESOLVED_BUYER', decision: 'Buyer evidence accepted. Refund requires a separate authorized finance process.', compensation: null });
    expect(persisted.resolvedAt).toBeInstanceOf(Date);
    expect(await prisma.ticketMessage.findMany({ where: { ticketId: ticket.id, senderType: 'SYSTEM' } })).toEqual([expect.objectContaining({ senderId: (await prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' } })).id, isInternal: false, body: '[RESOLVED_BUYER] Buyer evidence accepted. Refund requires a separate authorized finance process.' })]);
    expect((await admin.request.patch(`/api/admin/support/tickets/${ticket.id}/dispute`, { data: { status: 'UNDER_REVIEW', decision: 'Reopen terminal case' } })).status()).toBe(409);
    expect((await page.request.post(`/api/support/tickets/${ticket.id}/messages`, { data: { body: 'Try changing terminal conversation' } })).status()).toBe(409);
    expect(await prisma.disputeCase.findUniqueOrThrow({ where: { returnRequestId: request.id } })).toEqual(persisted);
    expect(await economicFacts(fixture, order.id)).toEqual(before);
    await page.reload();
    await expect(page.locator('article').filter({ hasText: 'Buyer evidence accepted. Refund requires a separate authorized finance process.' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('resolved-buyer-appeal.png'), fullPage: true });
  } finally {
    for (const context of contexts) await context.close();
  }
});

test('buy again merges current prices with multi-shop partial stock and retries retain quantities', async ({ page, browser, baseURL }, testInfo) => {
  const fixture = await commerceFixture(4);
  const [first, second, third, fourth] = fixture.shops;
  if (!first || !second || !third || !fourth) throw new Error('Four shops required');
  const order = await purchasedOrder(page, fixture);
  await prisma.productVariant.update({ where: { id: first.variant.id }, data: { price: 1299 } });
  await prisma.productVariant.update({ where: { id: second.variant.id }, data: { price: 999 } });
  await prisma.productVariant.update({ where: { id: third.variant.id }, data: { price: 777 } });
  await prisma.inventory.update({ where: { variantId: second.variant.id }, data: { quantityOnHand: 4, quantityReserved: 3 } });
  await prisma.product.update({ where: { id: fourth.product.id }, data: { status: 'ARCHIVED' } });
  const cart = await prisma.cart.findFirstOrThrow({ where: { userId: fixture.buyer.id, status: 'ACTIVE' } });
  await prisma.cartItem.createMany({ data: [
    { cartId: cart.id, variantId: first.variant.id, quantity: 1, unitPrice: 10000, currency: 'THB' },
    { cartId: cart.id, variantId: third.variant.id, quantity: 4, unitPrice: 10000, currency: 'THB' },
  ] });
  const before = await economicFacts(fixture, order.id);
  await page.goto(`/en/orders/${order.id}`);
  const responsePromise = page.waitForResponse(response => response.url().endsWith(`/api/orders/${order.id}/buy-again`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Buy again', exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(200);
  const result = await response.json();
  expect(result.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ variantId: first.variant.id, requestedQuantity: 2, existingQuantity: 1, targetQuantity: 2, addedQuantity: 1, finalQuantity: 2, kind: 'added', reason: null, unitPrice: '1299', currency: 'THB' }),
    expect.objectContaining({ variantId: second.variant.id, requestedQuantity: 2, existingQuantity: 0, targetQuantity: 2, addedQuantity: 1, finalQuantity: 1, availableQuantity: 1, kind: 'partial', reason: 'STOCK_LIMIT', unitPrice: '999' }),
    expect.objectContaining({ variantId: third.variant.id, requestedQuantity: 2, existingQuantity: 4, targetQuantity: 4, addedQuantity: 0, finalQuantity: 4, kind: 'already_in_cart', unitPrice: '777' }),
    expect.objectContaining({ variantId: fourth.variant.id, addedQuantity: 0, finalQuantity: 0, kind: 'skipped', reason: 'PRODUCT_UNAVAILABLE' }),
  ]));
  await expect(page).toHaveURL(`/en/orders/${order.id}`);
  await expect(page.getByText('Added 1. Cart quantity: 2.', { exact: true })).toBeVisible();
  await expect(page.getByText('Added 1. Cart quantity: 1 of 2 requested. The remaining stock is unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByText('Already in cart: 4. Current price applied.', { exact: true })).toBeVisible();
  await expect(page.getByText('Skipped: This product is unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open cart', exact: true })).toBeVisible();
  for (const response of await Promise.all(Array.from({ length: 4 }, () => page.request.post(`/api/orders/${order.id}/buy-again`)))) {
    expect(response.status(), await response.text()).toBe(200);
  }
  const items = await prisma.cartItem.findMany({ where: { cartId: cart.id }, orderBy: { variantId: 'asc' } });
  expect(items).toHaveLength(3);
  expect(items).toEqual(expect.arrayContaining([
    expect.objectContaining({ variantId: first.variant.id, quantity: 2, unitPrice: 1299n }),
    expect.objectContaining({ variantId: second.variant.id, quantity: 1, unitPrice: 999n }),
    expect.objectContaining({ variantId: third.variant.id, quantity: 4, unitPrice: 777n }),
  ]));
  expect(await economicFacts(fixture, order.id)).toEqual(before);
  const contexts: BrowserContext[] = [];
  try {
    const outsider = await actor(browser, baseURL, contexts);
    await loginUi(outsider, fourth.seller, '/en/orders');
    expect((await outsider.request.post(`/api/orders/${order.id}/buy-again`)).status()).toBe(404);
  } finally {
    for (const context of contexts) await context.close();
  }
  await page.getByRole('link', { name: 'Open cart', exact: true }).click();
  await expect(page).toHaveURL('/en/cart');
  await expect(page.getByText(first.product.title, { exact: true })).toBeVisible();
  await expect(page.getByText('฿12.99', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('repurchased-live-cart.png'), fullPage: true });
});

test('Thai all-unavailable repurchase stays on order and offers readable outcomes @mobile', async ({ page }, testInfo) => {
  const fixture = await commerceFixture();
  const [shop] = fixture.shops;
  if (!shop) throw new Error('Shop required');
  const order = await purchasedOrder(page, fixture);
  await prisma.productVariant.update({ where: { id: shop.variant.id }, data: { status: 'INACTIVE' } });
  const returnEvidence = `https://example.test/rejected-return/${'x'.repeat(250)}`;
  const item = order.items[0];
  if (!item) throw new Error('Order item required');
  await prisma.returnRequest.create({ data: {
    orderId: order.id, shopId: shop.shop.id, userId: fixture.buyer.id, status: 'REJECTED', reason: returnEvidence,
    items: { create: { orderItemId: item.id, quantity: 1 } },
  } });
  const before = await economicFacts(fixture, order.id);
  await page.goto(`/th/orders/${order.id}`);
  const responsePromise = page.waitForResponse(response => response.url().endsWith(`/api/orders/${order.id}/buy-again`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'ซื้ออีกครั้ง', exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(200);
  expect((await response.json()).items).toEqual([expect.objectContaining({ variantId: shop.variant.id, kind: 'skipped', reason: 'VARIANT_UNAVAILABLE', addedQuantity: 0, finalQuantity: 0 })]);
  await expect(page).toHaveURL(`/th/orders/${order.id}`);
  await expect(page.getByRole('link', { name: 'เปิดตะกร้า', exact: true })).toHaveCount(0);
  await expect(page.getByText('ไม่มีสินค้าที่เพิ่มได้ จำนวนสินค้าในตะกร้ายังคงเดิม', { exact: true })).toBeVisible();
  await expect(page.getByText('ข้ามรายการนี้: ตัวเลือกสินค้านี้ไม่พร้อมขาย', { exact: true })).toBeVisible();
  await expect(page.getByText(shop.product.title, { exact: true }).last()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await economicFacts(fixture, order.id)).toEqual(before);
  await page.screenshot({ path: testInfo.outputPath('thai-unavailable-repurchase.png'), fullPage: true });
  await page.getByRole('link', { name: 'ขอความช่วยเหลือเกี่ยวกับออเดอร์นี้', exact: true }).click();
  await expect(page).toHaveURL(`/th/orders/${order.id}/support`);
  await expect(page.getByText(returnEvidence, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('thai-rejected-return-long-url.png'), fullPage: true });
});

test('Thai buyer creates general support with no shop context @mobile', async ({ page, browser, baseURL }, testInfo) => {
  const fixture = await commerceFixture();
  const [shop] = fixture.shops;
  if (!shop) throw new Error('Shop required');
  await loginUi(page, fixture.buyer, '/en/profile');
  await page.getByRole('link', { name: 'Support and appeals', exact: true }).click();
  await expect(page).toHaveURL('/en/support');
  const evidence = `ต้องการความช่วยเหลือเกี่ยวกับบัญชีผู้ซื้อ https://example.test/evidence/${'x'.repeat(250)}`;
  const ticket = await createTicketUi(page, { subject: 'S'.repeat(200), body: evidence }, 'th');
  expect(ticket).toMatchObject({ userId: fixture.buyer.id, orderId: null, shopId: null, status: 'OPEN' });
  await page.screenshot({ path: testInfo.outputPath('thai-long-support-subject-and-url.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const contexts: BrowserContext[] = [];
  try {
    const seller = await actor(browser, baseURL, contexts);
    await loginUi(seller, shop.seller, '/en/seller/support');
    expect((await seller.request.get(`/api/seller/support/tickets/${ticket.id}`)).status()).toBe(404);
    const response = await seller.request.get('/api/seller/support/tickets');
    expect(await response.json()).toMatchObject({ items: [], total: 0 });
  } finally {
    for (const context of contexts) await context.close();
  }
  const response = await page.request.get(`/api/support/tickets/${ticket.id}`);
  expect(await response.json()).toMatchObject({ messages: { total: 1, items: [expect.objectContaining({ body: evidence, senderType: 'BUYER', isInternal: false })] } });
  await page.screenshot({ path: testInfo.outputPath('thai-general-support.png'), fullPage: true });
  await page.goto('/th/support');
  await expect(page.getByRole('link').filter({ hasText: 'S'.repeat(200) })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('thai-support-list-long-subject.png'), fullPage: true });
});
