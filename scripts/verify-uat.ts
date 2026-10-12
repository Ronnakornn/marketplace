import { existsSync, statSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "#generated/client/client.ts";
import type { Prisma, Order, OrderItem, ShopOrder, ShopSaleSnapshot, ItemSaleSnapshot } from "#generated/client/client.ts";
import { PinoLogger } from "#server/infrastructure/logging/pino-logger.ts";
import { assertUatDatabase, assetPath, loadUatData, loadUatEnvironment, scenarioState, uatId, UAT_ACCOUNTS, UAT_REVIEW_ASSETS, UAT_SCENARIOS, UAT_SHOPS } from "./uat-data.ts";
import type { UatProduct } from "./uat-data.ts";

const appContext = { logger: new PinoLogger({ environment: "production" }) };
const moneyFields = ["subtotal", "discountTotal", "shippingTotal", "taxTotal", "includedTaxTotal", "reportedTaxTotal", "grandTotal"] as const;
type Totals = Pick<Order, typeof moneyFields[number] | "currency">;
type CheckedItem = {
  item: Pick<OrderItem, "id" | "shopId" | "quantity" | "unitPrice" | "lineTotal" | "currency">;
  sale: Pick<ItemSaleSnapshot, "orderItemId" | "shopOrderId" | "originalQuantity" | "grossMerchandise" | "sellerCouponDiscount" | "platformCouponDiscount" | "coinDiscount" | "buyerMerchandise">;
};
export type PolicyOneArithmetic = {
  order: Totals;
  shops: Array<{
    shop: Totals & Pick<ShopOrder, "id" | "shopId">;
    sale: Pick<ShopSaleSnapshot, "shopOrderId" | "policyVersion" | "currency" | "commissionBase" | "commissionBps" | "originalCommission" | "originalShipping" | "buyerShipping" | "sellerShippingWaiver" | "platformShippingSubsidy">;
    items: CheckedItem[];
  }>;
};

function requireInvariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertPolicyOneArithmetic({ order, shops }: PolicyOneArithmetic): void {
  requireInvariant(shops.length > 0, "UAT order has no ShopOrders");
  requireInvariant(order.currency === "THB", "UAT order currency must be THB");
  requireInvariant(order.grandTotal === order.subtotal - order.discountTotal + order.shippingTotal + order.taxTotal, "UAT order total is inconsistent");
  for (const field of moneyFields) requireInvariant(shops.reduce((sum, entry) => sum + entry.shop[field], 0n) === order[field], `ShopOrder ${field} sum differs from Order`);
  for (const { shop, sale, items } of shops) {
    requireInvariant(sale.shopOrderId === shop.id && sale.policyVersion === 1 && sale.currency === shop.currency && shop.currency === order.currency, "UAT ShopSaleSnapshot identity is inconsistent");
    requireInvariant(items.length > 0, "UAT ShopOrder has no items");
    requireInvariant(Number.isInteger(sale.commissionBps) && sale.commissionBps >= 0 && sale.commissionBps <= 10000, "Invalid frozen commission rate");
    let gross = 0n;
    let sellerRights = 0n;
    let buyerCash = 0n;
    for (const { item, sale: line } of items) {
      requireInvariant(item.shopId === shop.shopId && item.currency === order.currency && line.orderItemId === item.id && line.shopOrderId === shop.id, "UAT item snapshot ownership is inconsistent");
      requireInvariant(Number.isInteger(item.quantity) && item.quantity > 0 && line.originalQuantity === item.quantity, "UAT original quantity is inconsistent");
      requireInvariant(item.unitPrice >= 0n && item.lineTotal === item.unitPrice * BigInt(item.quantity) && line.grossMerchandise === item.lineTotal, "UAT item price arithmetic is inconsistent");
      requireInvariant([line.grossMerchandise, line.sellerCouponDiscount, line.platformCouponDiscount, line.coinDiscount, line.buyerMerchandise].every((amount) => amount >= 0n), "UAT item money must be nonnegative");
      requireInvariant(line.buyerMerchandise + line.sellerCouponDiscount + line.platformCouponDiscount + line.coinDiscount === line.grossMerchandise, "UAT item funding does not equal gross merchandise");
      gross += line.grossMerchandise;
      sellerRights += line.grossMerchandise - line.sellerCouponDiscount;
      buyerCash += line.buyerMerchandise;
    }
    requireInvariant(sale.commissionBase === sellerRights && sale.originalCommission === sellerRights * BigInt(sale.commissionBps) / 10000n, "UAT original commission is inconsistent");
    requireInvariant([sale.originalShipping, sale.buyerShipping, sale.sellerShippingWaiver, sale.platformShippingSubsidy].every((amount) => amount >= 0n), "UAT shipping money must be nonnegative");
    requireInvariant(sale.originalShipping === sale.buyerShipping + sale.sellerShippingWaiver + sale.platformShippingSubsidy, "UAT original shipping funding is inconsistent");
    requireInvariant(shop.subtotal === gross && shop.discountTotal === gross - buyerCash && shop.shippingTotal === sale.buyerShipping && shop.grandTotal === buyerCash + sale.buyerShipping, "UAT shop price arithmetic is inconsistent");
    requireInvariant(shop.taxTotal === 0n && shop.includedTaxTotal === 0n && shop.reportedTaxTotal === 0n, "UAT policy 1 fixture must have zero tax");
  }
}

const orderInclude = {
  checkout: true,
  items: { include: { saleSnapshot: true } },
  shopOrders: { include: { saleSnapshot: true } },
  payments: { include: { events: true } },
  shipments: { include: { items: true } },
  inventoryReservations: { include: { inventory: true } },
  walletEntries: true,
  refunds: true,
  returnRequests: { include: { items: true } },
} satisfies Prisma.OrderInclude;

export async function verifyUat(db: PrismaClient, products: UatProduct[]) {
  const activity: string[] = [];
  for (const fixture of UAT_ACCOUNTS) {
    const user = await db.user.findUnique({ where: { email: fixture.email }, include: { accounts: true } });
    requireInvariant(user?.id === uatId(`user:${fixture.email}`), `Missing UAT identity ${fixture.email}`);
    requireInvariant(user.status === "ACTIVE" && user.emailVerified && user.role === fixture.role, `UAT login is unavailable or role changed ${fixture.email}`);
    requireInvariant(user.accounts.some((account) => account.providerId === "credential" && account.accountId === user.id && account.issuer === "local:credential" && !!account.password), `Missing UAT password credential ${fixture.email}`);
  }
  for (const fixture of UAT_SHOPS) {
    const shop = await db.shop.findUnique({ where: { id: uatId(`shop:${fixture.slug}`) }, include: { sellerProfile: true, settings: true, addresses: true, wallet: true } });
    requireInvariant(shop && shop.ownerId === uatId(`user:${fixture.ownerEmail}`) && shop.sellerProfile.userId === shop.ownerId, `Missing or unowned UAT shop ${fixture.slug}`);
    requireInvariant(shop.wallet?.currency === "THB" && shop.settings && shop.addresses.some((address) => address.type === "PICKUP"), `UAT shop setup is incomplete ${fixture.slug}`);
    for (const url of [shop.logoUrl, shop.coverUrl]) {
      if (url?.startsWith("/uat/")) requireInvariant(existsSync(assetPath(url)), `Missing UAT shop asset ${fixture.slug}`);
      else activity.push(`${fixture.slug} shop image changed`);
    }
    if (shop.status !== "ACTIVE" || shop.sellerProfile.verificationStatus !== "VERIFIED") activity.push(`${fixture.slug} seller status changed`);
  }
  let imageCount = 0;
  for (const fixture of products) {
    const product = await db.product.findUnique({ where: { id: uatId(`product:${fixture.slug}`) }, include: { images: true, variants: { include: { inventory: { include: { reservations: { where: { status: "ACTIVE" } } } } } }, category: true, brand: true } });
    requireInvariant(product && product.shopId === uatId(`shop:${fixture.shopSlug}`) && product.category && product.brand, `Missing UAT product or references ${fixture.slug}`);
    requireInvariant(product.images.length > 0, `UAT product has no photos ${fixture.slug}`);
    for (const image of product.images) {
      if (image.url.startsWith("/uat/")) requireInvariant(existsSync(assetPath(image.url)), `Dangling UAT product image ${image.url}`);
      else activity.push(`${fixture.slug} image changed`);
      imageCount++;
    }
    for (const variant of product.variants) {
      const inventory = variant.inventory;
      requireInvariant(inventory && inventory.quantityOnHand >= 0 && inventory.quantityReserved >= 0 && inventory.quantityOnHand >= inventory.quantityReserved, `UAT inventory is invalid ${variant.sku}`);
      const reserved = inventory.reservations.reduce((sum, hold) => sum + hold.quantity, 0);
      requireInvariant(inventory.quantityReserved === reserved, `Active reservation sum differs from inventory counter ${variant.sku}`);
      for (const hold of inventory.reservations) requireInvariant(hold.quantity > 0 && hold.orderId, `UAT active reservation has no order ${hold.id}`);
      const baseline = fixture.variants.find((candidate) => candidate.sku === variant.sku);
      if (baseline) {
        const committed = UAT_SCENARIOS.filter((scenario) => ["paid", "shipped", "delivered"].includes(scenario.stage)).reduce((sum, scenario) => sum + scenario.lines.filter((line) => line.sku === variant.sku).reduce((qty, line) => qty + line.quantity, 0), 0);
        if (variant.price !== BigInt(baseline.priceMinor) || inventory.quantityOnHand !== baseline.quantityOnHand - committed) activity.push(`${variant.sku} price or stock changed`);
      }
    }
    if (product.status !== fixture.status || product.titleTh !== fixture.titleTh || product.titleEn !== fixture.titleEn) activity.push(`${fixture.slug} listing changed`);
  }
  for (const code of ["UAT10", "UATFASHION100", "UATSHIP", "UATEXPIRED", "UATMIN"]) {
    const coupon = await db.coupon.findUnique({ where: { code } });
    requireInvariant(coupon?.id === uatId(`coupon:${code}`), `Missing UAT coupon ${code}`);
  }
  for (const fixture of UAT_SCENARIOS) {
    const order = await db.order.findUnique({ where: { orderNumber: fixture.orderNumber }, include: orderInclude });
    requireInvariant(order?.id === uatId(`order:${fixture.orderNumber}`) && order.userId === uatId(`user:${fixture.buyerEmail}`), `Missing UAT scenario ${fixture.orderNumber}`);
    requireInvariant(order.shippingName && order.shippingLine1 && order.shippingCity && order.shippingPostalCode && order.shippingCountry, `Missing address snapshot ${fixture.orderNumber}`);
    for (const field of moneyFields) requireInvariant(order.checkout[field] === order[field], `Checkout and Order ${field} differ ${fixture.orderNumber}`);
    requireInvariant(order.checkout.userId === order.userId && order.items.length === fixture.lines.length, `UAT scenario item count or owner changed ${fixture.orderNumber}`);
    assertPolicyOneArithmetic({ order, shops: order.shopOrders.map((shop) => {
      requireInvariant(shop.saleSnapshot, `Missing ShopSaleSnapshot ${fixture.orderNumber}`);
      return { shop, sale: shop.saleSnapshot, items: order.items.filter((item) => item.shopId === shop.shopId).map((item) => {
        requireInvariant(item.saleSnapshot, `Missing ItemSaleSnapshot ${fixture.orderNumber}`);
        return { item, sale: item.saleSnapshot };
      }) };
    }) });
    const payment = order.payments.find((payment) => payment.id === uatId(`payment:${fixture.orderNumber}`));
    requireInvariant(payment && payment.amount === order.grandTotal && payment.currency === order.currency && payment.status === order.paymentStatus, `UAT payment is inconsistent ${fixture.orderNumber}`);
    if (["SUCCEEDED", "REFUNDED"].includes(payment.status)) requireInvariant(payment.paidAt && payment.events.some((event) => event.eventType === "payment.paid"), `UAT successful payment has no fixture event ${fixture.orderNumber}`);
    if (payment.status === "FAILED") requireInvariant(payment.events.some((event) => event.eventType === "payment.failed"), `UAT failed payment has no event ${fixture.orderNumber}`);
    for (const spec of fixture.lines) {
      const item = order.items.find((item) => item.id === uatId(`order-item:${fixture.orderNumber}:${spec.sku}`));
      requireInvariant(item && item.quantity === spec.quantity && item.variantSku === spec.sku, `UAT original item missing ${fixture.orderNumber} / ${spec.sku}`);
      const hold = order.inventoryReservations.find((hold) => hold.id === uatId(`reservation:${fixture.orderNumber}:${spec.sku}`));
      requireInvariant(hold && hold.orderId === order.id && hold.checkoutId === order.checkoutId && hold.inventory.variantId === item.variantId && hold.quantity === item.quantity, `UAT reservation is unlinked ${fixture.orderNumber} / ${spec.sku}`);
      if (["SUCCEEDED", "REFUNDED"].includes(payment.status)) requireInvariant(hold.status === "COMMITTED", `Paid UAT stock is not committed ${fixture.orderNumber}`);
      if (["FAILED", "CANCELED"].includes(payment.status)) requireInvariant(["RELEASED", "EXPIRED"].includes(hold.status), `Failed UAT payment has an active stock hold ${fixture.orderNumber}`);
      if (["PENDING", "REQUIRES_ACTION"].includes(payment.status)) requireInvariant(hold.status === "ACTIVE", `Pending UAT payment has no active stock hold ${fixture.orderNumber}`);
    }
    for (const shipment of order.shipments) {
      requireInvariant(order.shopOrders.some((shop) => shop.shopId === shipment.shopId), `Shipment shop has no ShopOrder ${fixture.orderNumber}`);
      for (const link of shipment.items) requireInvariant(order.items.some((item) => item.id === link.orderItemId && item.shopId === shipment.shopId && item.quantity === link.quantity), `Shipment item crosses shops or has wrong quantity ${fixture.orderNumber}`);
      if (shipment.status === "DELIVERED") requireInvariant(shipment.shippedAt && shipment.deliveredAt && shipment.deliveredAt <= new Date(), `UAT delivery evidence is missing ${fixture.orderNumber}`);
    }
    if (["SUCCEEDED", "REFUNDED"].includes(payment.status)) requireInvariant(order.shipments.length === order.shopOrders.length, `Paid UAT order has no complete shop shipment split ${fixture.orderNumber}`);
    for (const shop of order.shopOrders) {
      const sale = shop.saleSnapshot!;
      if (["DELIVERED", "FULFILLED"].includes(order.status) && payment.status === "SUCCEEDED") requireInvariant(sale.recognizedAt, `Delivered UAT earnings have not been recognized ${fixture.orderNumber}`);
      const earnings = order.walletEntries.filter((entry) => entry.shopId === shop.shopId && entry.type === "order_earning");
      const fees = order.walletEntries.filter((entry) => entry.shopId === shop.shopId && entry.type === "commission_fee" && !entry.refundId);
      if (sale.recognizedAt) {
        requireInvariant(earnings.length === 1 && fees.length === (sale.originalCommission > 0n ? 1 : 0), `UAT earning or commission is missing/duplicated ${fixture.orderNumber}`);
        const pristine = order.refunds.every((refund) => refund.status !== "SUCCESS");
        if (pristine) requireInvariant(earnings[0]!.amount === sale.commissionBase + sale.buyerShipping + sale.platformShippingSubsidy && (fees[0]?.amount ?? 0n) === -sale.originalCommission, `UAT recognized earning differs from frozen economics ${fixture.orderNumber}`);
      } else requireInvariant(earnings.length === 0 && fees.length === 0, `UAT earnings were credited before recognition ${fixture.orderNumber}`);
    }
    const baseline = scenarioState(fixture);
    if (order.status !== baseline.status || payment.status !== baseline.paymentStatus || order.refunds.length > 0 || order.returnRequests.some((request) => request.status !== "REQUESTED")) activity.push(`${fixture.orderNumber} workflow changed`);
    if (fixture.stage === "delivered") {
      const request = order.returnRequests.find((request) => request.id === uatId(`return:${fixture.orderNumber}`));
      requireInvariant(request && request.userId === order.userId && request.shopId === uatId("shop:uat-home") && request.items.length === 1 && request.items[0]?.orderItemId === uatId(`order-item:${fixture.orderNumber}:UAT-43-1`) && request.items[0].quantity === 1, "UAT partial return fixture is missing or inconsistent");
      const review = await db.review.findUnique({ where: { id: uatId(`review:${fixture.orderNumber}`) }, include: { media: true, orderItem: { include: { variant: true } } } });
      requireInvariant(review && review.userId === order.userId && review.orderItemId === uatId(`order-item:${fixture.orderNumber}:UAT-43-1`) && review.productId === review.orderItem.variant.productId, "UAT review fixture ownership is inconsistent");
      for (const media of review.media) if (media.url.startsWith("/uat/")) requireInvariant(existsSync(assetPath(media.url)) && media.sizeBytes === statSync(assetPath(media.url)).size, `UAT review media is inconsistent ${media.url}`);
      if (review.status !== "PUBLISHED" || review.rating !== 5 || review.media.length !== 1 || review.media[0]?.url !== UAT_REVIEW_ASSETS[0]) activity.push(`${fixture.orderNumber} review changed`);
    }
  }
  for (const url of UAT_REVIEW_ASSETS) {
    const upload = await db.upload.findUnique({ where: { key: url.slice(1) } });
    requireInvariant(upload && upload.userId === uatId("user:uat-return@example.test") && upload.status === "COMPLETED" && upload.usage === "REVIEW_IMAGE" && upload.publicUrl === url && upload.fileSize === statSync(assetPath(url)).size && upload.contentType === "image/webp", `UAT review upload is inconsistent ${url}`);
  }
  return { accounts: UAT_ACCOUNTS.length, shops: UAT_SHOPS.length, products: products.length, images: imageCount, scenarios: UAT_SCENARIOS.length, testerActivity: [...new Set(activity)] };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--validate", "--allow-remote", "--allow-production"].includes(arg))) throw new Error("Unknown UAT verification argument");
  loadUatEnvironment();
  const products = await loadUatData();
  if (args.includes("--validate")) {
    appContext.logger.info("UAT catalog and local assets are valid; database was not accessed", { products: products.length });
    return;
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertUatDatabase(process.env, args) }) });
  try { appContext.logger.info("UAT integrity verification passed", await verifyUat(db, products)); }
  finally { await db.$disconnect(); }
}

if (import.meta.main) main().catch((error: unknown) => {
  appContext.logger.error("UAT integrity verification failed", { error: error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database URL]") : "Unknown error" });
  process.exitCode = 1;
});
