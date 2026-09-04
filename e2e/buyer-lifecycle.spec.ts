import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import en from "../messages/en.json" with { type: "json" };
import { prisma } from "#server/lib/prisma.ts";
import { signPaymentWebhookBody } from "#server/modules/payment/payment.webhook-signature.ts";
import type { PaymentWebhookBody } from "#server/modules/payment/payment.types.ts";
import { signIn } from "./helpers/storefront";

const lifecycleBuyer = { email: "buyer.lifecycle.e2e@example.com", password: "DemoPass123!" };
const lifecycleProductSlug = "e2e-buyer-lifecycle-product";
let checkoutVariantId = "";
let deliveredOrderId = "";
let deliveredItemId = "";
let fixtureProductId = "";
const createdOrderIds = new Set<string>();

async function deleteCheckoutOrders() {
  const oldOrders = await prisma.order.findMany({
    where: {
      OR: [
        { orderNumber: { startsWith: "E2E-BUYER-LIFECYCLE-" } },
        { payments: { some: { events: { some: { providerEventId: { startsWith: "buyer-ui-e2e-" } } } } } },
      ],
    },
    select: { id: true },
  });
  for (const { id } of oldOrders) createdOrderIds.add(id);
  const orderIds = [...createdOrderIds];
  if (!orderIds.length) return;
  const orders = await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { checkoutId: true } });
  const checkoutIds = orders.map(({ checkoutId }) => checkoutId);
  const reservations = checkoutIds.length
    ? await prisma.inventoryReservation.findMany({ where: { checkoutId: { in: checkoutIds } }, select: { id: true } })
    : [];
  const movementReferenceIds = [...orderIds, ...checkoutIds, ...reservations.map(({ id }) => id)];
  await prisma.walletLedgerEntry.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.sellerTransaction.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.buyerCoinLedger.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.returnRequest.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.inventoryMovement.deleteMany({ where: { referenceId: { in: movementReferenceIds } } });
  await prisma.supportTicket.updateMany({ where: { orderId: { in: orderIds } }, data: { orderId: null } });
  await prisma.disputeCase.updateMany({ where: { orderId: { in: orderIds } }, data: { orderId: null } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  if (checkoutIds.length) await prisma.checkout.deleteMany({ where: { id: { in: checkoutIds } } });
  createdOrderIds.clear();
}

async function deleteReviewAndReturnArtifacts() {
  if (deliveredItemId) {
    await prisma.review.deleteMany({ where: { orderItemId: deliveredItemId, body: "Production E2E delivered item review" } });
  }
  if (deliveredOrderId) {
    await prisma.returnRequest.deleteMany({ where: { orderId: deliveredOrderId, description: "Production E2E return request" } });
  }
}

test.beforeAll(async () => {
  await deleteCheckoutOrders();
  const oldBuyer = await prisma.user.findUnique({ where: { email: lifecycleBuyer.email }, select: { id: true } });
  if (oldBuyer) await prisma.user.delete({ where: { id: oldBuyer.id } });
  await prisma.product.deleteMany({ where: { slug: lifecycleProductSlug } });

  const [shop, category] = await Promise.all([
    prisma.shop.findFirst({ where: { slug: "urban-thread-co" } }),
    prisma.category.findFirst({ where: { isActive: true } }),
  ]);
  expect(shop, "Buyer lifecycle requires the seeded active shop shell").toBeTruthy();
  expect(category, "Buyer lifecycle requires an active category").toBeTruthy();

  const buyer = await prisma.user.create({
    data: { name: "Buyer Lifecycle E2E", email: lifecycleBuyer.email, role: "USER", status: "ACTIVE", emailVerified: true },
  });
  await prisma.account.create({
    data: { providerId: "credential", accountId: buyer.id, userId: buyer.id, password: await hashPassword(lifecycleBuyer.password), issuer: "local:credential" },
  });
  const address = await prisma.address.create({
    data: { userId: buyer.id, recipientName: "Buyer Lifecycle E2E", phone: "+66800000001", line1: "1 E2E Road", city: "Bangkok", region: "Bangkok", postalCode: "10110", country: "TH", isDefault: true },
  });

  const product = await prisma.product.create({
    data: { shopId: shop!.id, sellerProfileId: shop!.sellerProfileId, categoryId: category!.id, title: "Buyer Lifecycle E2E Product", slug: lifecycleProductSlug, status: "ACTIVE" },
  });
  fixtureProductId = product.id;
  const variant = await prisma.productVariant.create({
    data: { productId: product.id, sku: "E2E-BUYER-LIFECYCLE", title: "Default", price: BigInt(12_900), currency: "THB", status: "ACTIVE" },
  });
  await prisma.inventory.create({ data: { variantId: variant.id, quantityOnHand: 20, quantityReserved: 0 } });
  checkoutVariantId = variant.id;

  const cart = await prisma.cart.create({ data: { userId: buyer.id, status: "CHECKED_OUT" } });
  const checkout = await prisma.checkout.create({
    data: { cartId: cart.id, userId: buyer.id, status: "COMPLETED", subtotal: BigInt(12_900), grandTotal: BigInt(12_900), currency: "THB", expiresAt: new Date(Date.now() + 15 * 60_000) },
  });
  const delivered = await prisma.order.create({
    data: {
      checkoutId: checkout.id, userId: buyer.id, orderNumber: `E2E-BUYER-LIFECYCLE-DELIVERED-${Date.now()}`, status: "DELIVERED", paymentStatus: "SUCCEEDED",
      subtotal: BigInt(12_900), grandTotal: BigInt(12_900), currency: "THB", shippingName: address.recipientName, shippingPhone: address.phone,
      shippingLine1: address.line1, shippingCity: address.city, shippingRegion: address.region, shippingPostalCode: address.postalCode, shippingCountry: address.country,
    },
  });
  createdOrderIds.add(delivered.id);
  deliveredOrderId = delivered.id;
  const item = await prisma.orderItem.create({
    data: { orderId: delivered.id, shopId: shop!.id, variantId: variant.id, productTitle: product.title, productSlug: product.slug, variantTitle: variant.title, variantSku: variant.sku, shopName: shop!.name, shopSlug: shop!.slug, quantity: 1, unitPrice: variant.price, lineTotal: variant.price, currency: "THB", fulfillmentStatus: "DELIVERED" },
  });
  deliveredItemId = item.id;
  await prisma.shopOrder.create({ data: { orderId: delivered.id, shopId: shop!.id, status: "DELIVERED", fulfillmentStatus: "DELIVERED", subtotal: variant.price, grandTotal: variant.price, currency: "THB" } });
  const shipment = await prisma.shipment.create({ data: { orderId: delivered.id, shopId: shop!.id, status: "DELIVERED", carrier: "E2E Express", trackingNumber: `E2E${Date.now()}`, shippedAt: new Date(), deliveredAt: new Date() } });
  await prisma.shipmentItem.create({ data: { shipmentId: shipment.id, orderItemId: item.id, quantity: 1 } });
});

test.afterAll(async () => {
  await deleteReviewAndReturnArtifacts();
  await deleteCheckoutOrders();
  if (fixtureProductId) await prisma.product.deleteMany({ where: { id: fixtureProductId } });
  await prisma.user.deleteMany({ where: { email: lifecycleBuyer.email } });
  await prisma.$disconnect();
});

test("buyer completes checkout in the UI and sees a verified paid order", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000" });
  const page = await context.newPage();
  await signIn(page, lifecycleBuyer);

  const clear = await page.request.delete("/api/cart");
  expect(clear.ok(), await clear.text()).toBeTruthy();
  const added = await page.request.post("/api/cart/items", { data: { variantId: checkoutVariantId, quantity: 1 } });
  expect(added.ok(), await added.text()).toBeTruthy();

  await page.goto("/en/checkout");
  const placeOrder = page.getByRole("button", { name: en.checkout.placeOrder });
  await expect(placeOrder).toBeEnabled();
  await placeOrder.click();

  const paymentLink = page.getByRole("link", { name: en.checkout.viewPaymentStatus });
  await expect(paymentLink).toBeVisible();
  const paymentUrl = await paymentLink.getAttribute("href");
  expect(paymentUrl).toBeTruthy();
  const checkoutUrl = new URL(paymentUrl!, "http://localhost");
  const paymentId = checkoutUrl.searchParams.get("paymentId") ?? checkoutUrl.pathname.split("/").at(-1)!;
  const checkoutOrderId = checkoutUrl.searchParams.get("orderId");
  expect(paymentId).toBeTruthy();

  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const orderId = checkoutOrderId ?? payment.orderId;
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  createdOrderIds.add(order.id);
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  expect(webhookSecret, "PAYMENT_WEBHOOK_SECRET is required for buyer lifecycle E2E").toBeTruthy();
  const timestamp = new Date();
  const webhook: PaymentWebhookBody = {
    provider: payment.provider,
    providerRef: `buyer-ui-e2e-${payment.id}-${timestamp.getTime()}`,
    eventType: "payment.paid",
    paymentId: payment.id,
    orderId: order.id,
    amount: Number(payment.amount),
  };
  const webhookResponse = await page.request.post("/api/payment/webhook", {
    data: webhook,
    headers: {
      "x-payment-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "x-payment-signature": signPaymentWebhookBody(webhook, webhookSecret!, timestamp),
    },
  });
  expect(webhookResponse.ok(), await webhookResponse.text()).toBeTruthy();

  await page.goto(`/en/payment/return?orderId=${order.id}`);
  await expect(page.getByText(en.buyer.paymentConfirmed).first()).toBeVisible();
  await page.getByRole("link", { name: en.buyer.viewOrder }).click();
  await expect(page).toHaveURL(`/en/orders/${order.id}`);
  await expect(page.getByText(order.orderNumber)).toBeVisible();
  await page.getByRole("link", { name: en.order.trackOrder }).click();
  await expect(page).toHaveURL(`/en/orders/${order.id}/tracking`);
  await context.close();
});

test("buyer submits a review and a return for an eligible delivered item", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000" });
  const page = await context.newPage();
  await signIn(page, lifecycleBuyer);

  await page.goto(`/en/orders/${deliveredOrderId}/review`);
  const reviewChoice = page.locator(`input[name="orderItem"][value="${deliveredItemId}"]`);
  await reviewChoice.check();
  await page.getByLabel(`4 ${en.buyer.rating}`).click();
  await page.getByLabel(en.buyer.comment).fill("Production E2E delivered item review");
  await page.getByRole("button", { name: en.buyer.submitReview }).click();
  await expect(page.getByText(en.buyer.reviewSubmitted)).toBeVisible();

  await page.goto(`/en/orders/${deliveredOrderId}/returns/new`);
  const returnChoice = page.locator(`input[name="returnItem"][value="${deliveredItemId}"]`);
  await returnChoice.check();
  await page.getByLabel(en.buyer.details).fill("Production E2E return request");
  await page.getByRole("button", { name: en.buyer.submitRequest }).click();
  await expect(page.getByText(en.buyer.returnSubmitted)).toBeVisible();
  await context.close();
});
