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

export async function createFinanceFixture(db: ReturnType<typeof financeDatabase>, snapshotted = false) {
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
  if (snapshotted) {
    const shopOrder = await db.shopOrder.findFirstOrThrow({ where: { orderId: order.id } });
    await db.shopSaleSnapshot.create({ data: { shopOrderId: shopOrder.id, currency: "THB", commissionBase: 8000n,
      commissionBps: 1000, originalCommission: 800n, originalShipping: 500n, buyerShipping: 500n,
      sellerShippingWaiver: 0n, platformShippingSubsidy: 0n, recognizedAt: new Date() } });
    for (const item of items) await db.itemSaleSnapshot.create({ data: { orderItemId: item.id, shopOrderId: shopOrder.id,
      originalQuantity: 1, grossMerchandise: item.lineTotal, sellerCouponDiscount: item.lineTotal === 4000n ? 800n : 1200n,
      platformCouponDiscount: 0n, coinDiscount: 0n, buyerMerchandise: item.lineTotal === 4000n ? 3200n : 4800n } });
    await db.walletLedgerEntry.updateMany({ where: { walletId: wallet.id }, data: { amount: 8500n, orderId: order.id } });
    await db.walletLedgerEntry.create({ data: { walletId: wallet.id, shopId: shop.id, orderId: order.id,
      type: "commission_fee", amount: -800n, currency: "THB" } });
    await db.shipment.create({ data: { orderId: order.id, shopId: shop.id, status: "DELIVERED", shippedAt: new Date(), deliveredAt: new Date() } });
  }
  return { buyer, seller, admin, secondAdmin, shop, wallet, order, items };
}

export async function createPartialFinanceFixture(db: ReturnType<typeof financeDatabase>, coins = false) {
    const f = await createFinanceFixture(db, true)
    const item = f.items[0]!
    await db.orderItem.delete({ where: { id: f.items[1]!.id } })
    const totals = coins
      ? { subtotal: 303n, discountTotal: 303n, shippingTotal: 0n, taxTotal: 0n, includedTaxTotal: 20n, reportedTaxTotal: 20n, grandTotal: 0n }
      : { subtotal: 123n, discountTotal: 22n, shippingTotal: 0n, taxTotal: 0n, includedTaxTotal: 7n, reportedTaxTotal: 7n, grandTotal: 101n }
    const net = coins ? 280n : 94n
    const tax = coins ? 20n : 7n
    const fee = coins ? 28n : 9n
    await db.checkout.update({ where: { id: f.order.checkoutId }, data: totals })
    await db.order.update({ where: { id: f.order.id }, data: totals })
    await db.shopOrder.updateMany({ where: { orderId: f.order.id }, data: totals })
    await db.payment.updateMany({ where: { orderId: f.order.id }, data: { amount: totals.grandTotal } })
    await db.orderItem.update({ where: { id: item.id }, data: { quantity: 3, unitPrice: coins ? 101n : 41n, lineTotal: totals.subtotal } })
    const shopOrder = await db.shopOrder.findFirstOrThrow({ where: { orderId: f.order.id } })
    await db.shopSaleSnapshot.update({ where: { shopOrderId: shopOrder.id }, data: { policyVersion: 2,
      commissionBase: net, originalCommission: fee, originalShipping: 0n, buyerShipping: 0n, platformShippingSubsidy: 0n,
      taxRatePpm: 70000, taxMode: 'INCLUSIVE', taxFundingBasis: 'SELLER_AFTER_SHOP_COUPON', taxableShipping: false,
      taxShippingBasis: 'SELLER_SHIPPING_AFTER_WAIVER', taxRounding: 'LINE_HALF_UP', taxCustodian: 'SELLER', taxExclusiveFunding: 'BUYER', taxPolicyRevision: 'original-fixture',
      sellerGrossMerchandise: coins ? 300n : 101n, sellerGrossShipping: 0n, buyerShippingNet: 0n, buyerShippingTax: 0n, platformShippingNet: 0n, platformShippingTax: 0n,
      includedTaxTotal: tax, addedTaxTotal: 0n, reportedTaxTotal: tax } })
    await db.itemSaleSnapshot.update({ where: { orderItemId: item.id }, data: { originalQuantity: 3, grossMerchandise: totals.subtotal, sellerCouponDiscount: coins ? 3n : 22n,
      buyerMerchandise: coins ? 0n : 101n, coinDiscount: coins ? 300n : 0n, buyerMerchandiseNet: coins ? 0n : 94n, buyerMerchandiseTax: coins ? 0n : 7n,
      platformCouponNet: 0n, platformCouponTax: 0n, coinFundingNet: coins ? 280n : 0n, coinFundingTax: coins ? 20n : 0n,
      originalCashbackEligibleNet: coins ? 0n : 94n, originalAffiliateEligibleNet: coins ? 0n : 94n } })
    await db.walletLedgerEntry.updateMany({ where: { walletId: f.wallet.id, type: 'order_earning' }, data: { amount: coins ? 300n : 101n } })
    await db.walletLedgerEntry.updateMany({ where: { walletId: f.wallet.id, type: 'commission_fee' }, data: { amount: -fee } })
    if (coins) {
      const wallet = await db.buyerCoinWallet.create({ data: { userId: f.buyer.id, balance: 0n, lifetimeSpent: 3n } })
      await db.buyerCoinLedger.create({ data: { walletId: wallet.id, userId: f.buyer.id, orderId: f.order.id, type: 'SPENT', status: 'USED', amount: 3n } })
    }
    return { ...f, item, shopOrder };
}
