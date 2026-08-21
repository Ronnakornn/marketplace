import { expect, test } from "@playwright/test";
import { prisma } from "#server/lib/prisma.ts";
import { signPaymentWebhookBody } from "#server/modules/payment/payment.webhook-signature.ts";
import type { PaymentWebhookBody } from "#server/modules/payment/payment.types.ts";
import { signIn, storefrontFixture } from "./helpers/storefront";
import { isolateRateLimit } from "./helpers/seller";

const fixture = {
  products: [
    { shopSlug: "urban-thread-co", slug: "e2e-paid-checkout-fashion", sku: "E2E-PAID-FASHION", stock: 9, quantity: 2 },
    { shopSlug: "gadget-harbor", slug: "e2e-paid-checkout-gadget", sku: "E2E-PAID-GADGET", stock: 6, quantity: 1 },
  ],
};

let addressId = "";
let variants: Array<{ id: string; inventoryId: string; stock: number; quantity: number }> = [];

test.beforeAll(async () => {
  const buyer = await prisma.user.findUnique({ where: { email: storefrontFixture.buyer.email } });
  expect(buyer, "Run `bun run db:seed` before buyer checkout E2E").toBeTruthy();
  const address = await prisma.address.findFirst({ where: { userId: buyer!.id }, orderBy: { createdAt: "asc" } });
  expect(address, "Seeded buyer needs a checkout address").toBeTruthy();
  addressId = address!.id;

  const category = await prisma.category.findFirst({ where: { isActive: true } });
  expect(category, "Buyer checkout E2E requires an active category").toBeTruthy();

  variants = [];
  for (const item of fixture.products) {
    const shop = await prisma.shop.findFirst({ where: { slug: item.shopSlug } });
    expect(shop, `Seeded shop ${item.shopSlug} is required`).toBeTruthy();
    await prisma.shop.update({ where: { id: shop!.id }, data: { status: "ACTIVE" } });

    const existingProduct = await prisma.product.findFirst({ where: { shopId: shop!.id, slug: item.slug } });
    const product = await prisma.product.upsert({
      where: { id: existingProduct?.id ?? "00000000-0000-0000-0000-000000000000" },
      create: {
        shopId: shop!.id,
        sellerProfileId: shop!.sellerProfileId,
        categoryId: category!.id,
        title: `Paid checkout ${item.sku}`,
        titleEn: `Paid checkout ${item.sku}`,
        titleTh: `สินค้าชำระเงินจริง ${item.sku}`,
        slug: item.slug,
        status: "ACTIVE",
      },
      update: { categoryId: category!.id, status: "ACTIVE", deletedAt: null },
    });
    const variant = await prisma.productVariant.upsert({
      where: { productId_sku: { productId: product.id, sku: item.sku } },
      create: { productId: product.id, sku: item.sku, title: "Default", price: BigInt(12_900), currency: "THB", status: "ACTIVE" },
      update: { price: BigInt(12_900), currency: "THB", status: "ACTIVE" },
    });
    const inventory = await prisma.inventory.upsert({
      where: { variantId: variant.id },
      create: { variantId: variant.id, quantityOnHand: item.stock, quantityReserved: 0 },
      update: { quantityOnHand: item.stock, quantityReserved: 0 },
    });
    await prisma.inventoryReservation.updateMany({
      where: { inventoryId: inventory.id, status: "ACTIVE" },
      data: { status: "RELEASED" },
    });
    variants.push({ id: variant.id, inventoryId: inventory.id, stock: item.stock, quantity: item.quantity });
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("buyer multi-shop checkout commits reserved stock only after a signed paid webhook", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000" });
  const page = await context.newPage();
  await isolateRateLimit(page, testInfo);
  await signIn(page, storefrontFixture.buyer);

  const clearResponse = await page.request.delete("/api/cart");
  expect(clearResponse.ok(), await clearResponse.text()).toBeTruthy();

  let cart: { id: string; shops: Array<{ items: Array<{ id: string }> }> } | null = null;
  for (const variant of variants) {
    const response = await page.request.post("/api/cart/items", { data: { variantId: variant.id, quantity: variant.quantity } });
    const responseText = await response.text();
    expect(response.ok(), `Add to cart failed: ${response.status()} ${responseText}`).toBeTruthy();
    cart = JSON.parse(responseText);
  }
  expect(cart).toBeTruthy();
  const cartItemIds = cart!.shops.flatMap((shop) => shop.items.map((item) => item.id));
  expect(cartItemIds).toHaveLength(2);

  const checkoutResponse = await page.request.post("/api/checkout", {
    data: { cartId: cart!.id, cartItemIds, addressId, paymentMethod: "card", locale: "en" },
  });
  const checkoutText = await checkoutResponse.text();
  expect(checkoutResponse.ok(), `Checkout failed: ${checkoutResponse.status()} ${checkoutText}`).toBeTruthy();
  const checkout = JSON.parse(checkoutText) as { orderId: string; paymentId: string; totalCents: number };

  const activeReservations = await prisma.inventoryReservation.findMany({ where: { orderId: checkout.orderId } });
  expect(activeReservations).toHaveLength(2);
  expect(activeReservations.every((reservation) => reservation.status === "ACTIVE")).toBeTruthy();
  for (const variant of variants) {
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { id: variant.inventoryId } });
    expect(inventory.quantityOnHand).toBe(variant.stock);
    expect(inventory.quantityReserved).toBe(variant.quantity);
  }

  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  expect(webhookSecret, "PAYMENT_WEBHOOK_SECRET is required for payment E2E").toBeTruthy();
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: checkout.paymentId } });
  const timestamp = new Date();
  const webhookBody: PaymentWebhookBody = {
    provider: payment.provider,
    providerRef: `e2e-paid-${checkout.paymentId}-${timestamp.getTime()}`,
    eventType: "payment.paid",
    paymentId: checkout.paymentId,
    orderId: checkout.orderId,
    amount: checkout.totalCents,
  };
  const webhookHeaders = {
    "x-payment-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "x-payment-signature": signPaymentWebhookBody(webhookBody, webhookSecret!, timestamp),
  };
  const paidResponse = await page.request.post("/api/payment/webhook", { data: webhookBody, headers: webhookHeaders });
  expect(paidResponse.ok(), await paidResponse.text()).toBeTruthy();

  const order = await prisma.order.findUniqueOrThrow({ where: { id: checkout.orderId }, include: { shipments: true } });
  expect(order.status).toBe("PAID");
  expect(order.paymentStatus).toBe("SUCCEEDED");
  expect(new Set(order.shipments.map((shipment) => shipment.shopId)).size).toBe(2);
  const committedReservations = await prisma.inventoryReservation.findMany({ where: { orderId: checkout.orderId } });
  expect(committedReservations.every((reservation) => reservation.status === "COMMITTED")).toBeTruthy();
  for (const variant of variants) {
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { id: variant.inventoryId } });
    expect(inventory.quantityOnHand).toBe(variant.stock - variant.quantity);
    expect(inventory.quantityReserved).toBe(0);
  }

  const duplicateResponse = await page.request.post("/api/payment/webhook", { data: webhookBody, headers: webhookHeaders });
  const duplicateText = await duplicateResponse.text();
  expect(duplicateResponse.ok(), duplicateText).toBeTruthy();
  expect(JSON.parse(duplicateText)).toMatchObject({ ok: true, code: "WEBHOOK_ALREADY_PROCESSED" });
  await context.close();
});
