import { expect, test, type Page } from '@playwright/test';
import { prisma } from '#server/lib/prisma.ts';
import en from '../messages/en.json' with { type: 'json' };
import { commerceFixture, prepareCart } from './helpers/commerce-fixtures';
import { isolateActorPage, newActorContext } from './helpers/browser-context';

test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(120_000);
test.beforeEach(async ({ page }) => { await isolateActorPage(page); });
test.afterAll(async () => { await prisma.$disconnect(); });

async function assertSingleReservation(buyerId: string, variantId: string) {
  expect(await prisma.order.count({ where: { userId: buyerId } })).toBe(1);
  expect(await prisma.checkout.count({ where: { userId: buyerId } })).toBe(1);
  const order = await prisma.order.findFirstOrThrow({ where: { userId: buyerId } });
  expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
  const inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });
  const reservations = await prisma.inventoryReservation.findMany({ where: { checkoutId: order.checkoutId } });
  expect(reservations).toHaveLength(1);
  expect(reservations[0]).toMatchObject({ inventoryId: inventory.id, quantity: 2, status: 'ACTIVE' });
  expect(inventory).toMatchObject({
    quantityOnHand: 10, quantityReserved: 2,
  });
  return order;
}

async function assertOrderHistory(page: Page, orderId: string, orderNumber: string) {
  await page.goto('/en/orders');
  await expect(page.getByText(orderNumber, { exact: true })).toBeVisible();
  await page.goto(`/en/orders/${orderId}`);
  await expect(page.getByRole('heading', { name: orderNumber, exact: true })).toBeVisible();
}

test('double-clicking checkout creates one order, payment and stock reservation', async ({ browser, baseURL }) => {
  const context = await newActorContext(browser, { baseURL });
  const page = await context.newPage();
  let release!: () => void;
  const responseGate = new Promise<void>((resolve) => { release = resolve; });
  try {
    const fixture = await commerceFixture();
    await prepareCart(page, fixture);
    let submissions = 0;
    await page.route('**/api/checkout', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      submissions += 1;
      // Execute the real transaction, but hold the response until both clicks finish.
      const response = await route.fetch();
      await responseGate;
      await route.fulfill({ response });
    });
    const button = page.getByRole('button', { name: en.checkout.placeOrder, exact: true });
    await button.dblclick();
    await expect(button).toBeDisabled();
    release();
    await expect(page.getByRole('link', { name: en.checkout.viewPaymentStatus })).toBeVisible();
    expect(submissions).toBe(1);
    const order = await assertSingleReservation(fixture.buyer.id, fixture.shops[0]!.variant.id);
    await page.reload();
    await expect(page.getByRole('button', { name: en.checkout.placeOrder, exact: true })).toHaveCount(0);
    await assertOrderHistory(page, order.id, order.orderNumber);
    await assertSingleReservation(fixture.buyer.id, fixture.shops[0]!.variant.id);
  } finally {
    release();
    await context.close();
  }
});

test('lost checkout response after commit recovers in history without duplicate orders, payments or reservations', async ({ browser, baseURL }) => {
  const context = await newActorContext(browser, { baseURL });
  const page = await context.newPage();
  try {
    const fixture = await commerceFixture();
    await prepareCart(page, fixture);
    let committed: { orderId: string; orderNo: string } | undefined;
    await page.route('**/api/checkout', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      // A successful API transaction really commits; only its browser response is lost.
      const response = await route.fetch();
      expect(response.ok(), await response.text()).toBeTruthy();
      committed = await response.json();
      await route.abort('connectionreset');
    }, { times: 1 });
    const failure = page.waitForEvent('requestfailed', { predicate: request =>
      request.method() === 'POST' && new URL(request.url()).pathname === '/api/checkout' });
    const button = page.getByRole('button', { name: en.checkout.placeOrder, exact: true });
    await button.click();
    await failure;
    await expect(button).toBeDisabled();
    expect(committed).toBeDefined();
    const order = await assertSingleReservation(fixture.buyer.id, fixture.shops[0]!.variant.id);
    expect(order.id).toBe(committed!.orderId);
    await assertOrderHistory(page, order.id, order.orderNumber);
    await page.goBack();
    await page.reload();
    await expect(page.getByText(order.orderNumber, { exact: true })).toBeVisible();
    await assertSingleReservation(fixture.buyer.id, fixture.shops[0]!.variant.id);
  } finally {
    await context.close();
  }
});
