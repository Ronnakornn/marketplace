import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "#generated/client/client.ts";

export function financeDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname) || !url.pathname.startsWith("/marketplace_e2e_")) {
    throw new Error("Finance E2E requires an isolated local marketplace_e2e_* database");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
}

export async function createFinanceFixture(db: ReturnType<typeof financeDatabase>) {
  const key = randomUUID();
  const password = "DemoPass123!";
  const passwordHash = await hashPassword(password);
  async function identity(label: string, role: "USER" | "ADMIN" = "USER") {
    const email = `${label}.${key}@example.com`;
    const user = await db.user.create({ data: { email, name: label, role, status: "ACTIVE", emailVerified: true } });
    await db.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: passwordHash, issuer: "local:credential" } });
    return { ...user, password };
  }
  const buyer = await identity("finance-buyer");
  const seller = await identity("finance-seller");
  const admin = await identity("finance-approver", "ADMIN");
  const secondAdmin = await identity("finance-completer", "ADMIN");
  const profile = await db.sellerProfile.create({ data: { userId: seller.id } });
  const shop = await db.shop.create({ data: { ownerId: seller.id, sellerProfileId: profile.id, name: `Finance ${key}`, slug: `finance-${key}`, status: "ACTIVE", contactEmail: seller.email, contactPhone: "+66800000000" } });
  const wallet = await db.shopWallet.create({ data: { shopId: shop.id, currency: "THB" } });
  await db.walletLedgerEntry.create({ data: { walletId: wallet.id, shopId: shop.id, type: "order_earning", amount: 10000n, currency: "THB", description: "E2E opening settled balance" } });
  // A delivered, paid historical order is the precondition; these tests exercise finance after delivery.
  const cart = await db.cart.create({ data: { userId: buyer.id, status: "CHECKED_OUT" } });
  const checkout = await db.checkout.create({ data: { cartId: cart.id, userId: buyer.id, status: "COMPLETED", subtotal: 10000n, discountTotal: 2000n, grandTotal: 8500n, shippingTotal: 500n, currency: "THB", expiresAt: new Date() } });
  const order = await db.order.create({ data: { checkoutId: checkout.id, userId: buyer.id, orderNumber: `FINANCE-${key}`, status: "DELIVERED", paymentStatus: "SUCCEEDED", subtotal: 10000n, discountTotal: 2000n, shippingTotal: 500n, grandTotal: 8500n, currency: "THB", shippingName: buyer.name, shippingPhone: "+66800000000", shippingLine1: "1 Test Road", shippingCity: "Bangkok", shippingRegion: "Bangkok", shippingPostalCode: "10110", shippingCountry: "TH" } });
  await db.shopOrder.create({ data: { orderId: order.id, shopId: shop.id, status: "DELIVERED", fulfillmentStatus: "DELIVERED", subtotal: 10000n, discountTotal: 2000n, shippingTotal: 500n, grandTotal: 8500n, currency: "THB" } });
  const items = [];
  for (const price of [4000n, 6000n]) {
    const product = await db.product.create({ data: { shopId: shop.id, sellerProfileId: profile.id, title: `Finance item ${price}`, slug: `finance-${key}-${price}`, status: "ACTIVE" } });
    const variant = await db.productVariant.create({ data: { productId: product.id, title: "Default", sku: product.slug, price, currency: "THB", status: "ACTIVE" } });
    items.push(await db.orderItem.create({ data: { orderId: order.id, shopId: shop.id, variantId: variant.id, productTitle: product.title, productSlug: product.slug, variantTitle: variant.title, variantSku: variant.sku, shopName: shop.name, shopSlug: shop.slug, quantity: 1, unitPrice: price, lineTotal: price, currency: "THB", fulfillmentStatus: "DELIVERED" } }));
  }
  await db.payment.create({ data: { orderId: order.id, provider: "mock", providerIntentId: key, status: "SUCCEEDED", amount: 8500n, currency: "THB", paidAt: new Date() } });
  return { buyer, seller, admin, secondAdmin, shop, wallet, order, items };
}
