import { seedProductImages } from "./seed-product-images.ts";
import { statSync } from "node:fs";
import sharp from "sharp";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "#generated/client/client.ts";
import type { Prisma } from "#generated/client/client.ts";
import { PinoLogger } from "#server/infrastructure/logging/pino-logger.ts";
import { CacheInvalidation } from "#server/modules/cache/cache.invalidation.ts";
import { CacheService } from "#server/modules/cache/cache.service.ts";
import { createRedisCacheClient, getCacheConfigFromEnv } from "#server/modules/cache/cache.client.ts";
import {
  assertUatDatabase, assetPath, calculateUatTotals, loadUatData, loadUatEnvironment,
  scenarioState, uatId, UAT_ACCOUNTS, UAT_CATEGORIES, UAT_COMMISSION_BPS,
  UAT_PASSWORD, UAT_REVIEW_ASSETS, UAT_SCENARIOS, UAT_SHIPPING, UAT_SHOPS,
} from "./uat-data.ts";
import type { UatProduct, UatScenario } from "./uat-data.ts";

type Tx = Prisma.TransactionClient;
const appContext = { logger: new PinoLogger({ environment: "production" }), config: { environment: "uat" } };
const buyerEmails = new Set(["uat-buyer@example.test", "uat-return@example.test"]);
const address = {
  phone: "+66800000001", line1: "99 ถนนทดสอบ UAT", line2: "ข้อมูลสมมติ",
  city: "กรุงเทพมหานคร", region: "กรุงเทพมหานคร", postalCode: "10110", country: "TH",
};

async function seedAccounts(tx: Tx, passwordHash: string, resetPassword: boolean, now: Date) {
  const newBuyers = new Set<string>();
  for (const fixture of UAT_ACCOUNTS) {
    const id = uatId(`user:${fixture.email}`);
    const existing = await tx.user.findUnique({ where: { email: fixture.email } });
    if (existing && existing.id !== id) throw new Error(`UAT account email already belongs to another identity ${fixture.email}`);
    if (!existing) {
      await tx.user.create({ data: { id, ...fixture, status: "ACTIVE", emailVerified: true } });
      if (buyerEmails.has(fixture.email)) newBuyers.add(fixture.email);
    }
    const credential = await tx.account.findUnique({ where: { providerId_accountId: { providerId: "credential", accountId: id } } });
    if (!credential) {
      await tx.account.create({ data: { id: uatId(`credential:${fixture.email}`), userId: id, accountId: id, providerId: "credential", issuer: "local:credential", password: passwordHash } });
    } else if (resetPassword) {
      await tx.account.update({ where: { id: credential.id }, data: { password: passwordHash } });
    }
    if (newBuyers.has(fixture.email)) {
      await tx.address.create({ data: { id: uatId(`address:${fixture.email}`), userId: id, recipientName: fixture.name, ...address, isDefault: true } });
      await tx.buyerCoinWallet.create({ data: { id: uatId(`coins:${fixture.email}`), userId: id } });
    }
  }
  for (const [index, fixture] of UAT_SHOPS.entries()) {
    const ownerId = uatId(`user:${fixture.ownerEmail}`);
    const profileId = uatId(`seller:${fixture.slug}`);
    await tx.sellerProfile.upsert({ where: { userId: ownerId }, update: {}, create: {
      id: profileId, userId: ownerId, verificationStatus: "VERIFIED", verifiedAt: now,
      legalName: `${fixture.nameTh} ผู้ขายทดสอบ`, displayName: fixture.nameTh,
      contactEmail: fixture.ownerEmail, contactPhone: `+6680000001${index}`,
    } });
    const shopId = uatId(`shop:${fixture.slug}`);
    const existing = await tx.shop.findUnique({ where: { id: shopId } });
    if (existing) {
      if (existing.ownerId !== ownerId || existing.sellerProfileId !== profileId) throw new Error(`UAT shop ownership is inconsistent ${fixture.slug}`);
      continue;
    }
    if (await tx.shop.findFirst({ where: { slug: fixture.slug } })) throw new Error(`UAT shop slug belongs to another shop ${fixture.slug}`);
    await tx.shop.create({ data: {
      id: shopId, ownerId, sellerProfileId: profileId, name: fixture.nameTh, slug: fixture.slug,
      contactEmail: fixture.ownerEmail, contactPhone: `+6680000001${index}`, status: "ACTIVE",
      approvedById: uatId("user:uat-admin@example.test"), approvedAt: now,
      description: `${fixture.nameTh} ร้านสมมติสำหรับ UAT`, descriptionTh: `${fixture.nameTh} ร้านสมมติสำหรับ UAT`,
      descriptionEn: `${fixture.nameEn} is a local acceptance testing shop.`,
      logoUrl: `/uat/shops/${fixture.slug}-logo.svg`, coverUrl: `/uat/shops/${fixture.slug}-cover.svg`,
    } });
    await tx.shopWallet.create({ data: { id: uatId(`wallet:${fixture.slug}`), shopId, currency: "THB" } });
    await tx.shopStaff.create({ data: { id: uatId(`staff:${fixture.slug}`), shopId, userId: ownerId, role: "OWNER", status: "ACTIVE", joinedAt: now } });
    await tx.shopSetting.create({ data: {
      id: uatId(`setting:${fixture.slug}`), shopId, shippingFee: UAT_SHIPPING, defaultShippingProvider: "UAT Express",
      returnPolicy: "ขอคืนสินค้าตามระยะเวลาที่ระบบกำหนด", returnPolicyTh: "ขอคืนสินค้าตามระยะเวลาที่ระบบกำหนด", returnPolicyEn: "Returns follow the configured return window.",
      shippingPolicy: "จัดส่งหลังยืนยันการชำระเงิน ค่าส่ง 40 บาทต่อร้าน", shippingPolicyTh: "จัดส่งหลังยืนยันการชำระเงิน ค่าส่ง 40 บาทต่อร้าน", shippingPolicyEn: "Dispatch after payment confirmation. Shipping is THB 40 per shop.",
    } });
    await tx.shopAddress.create({ data: { id: uatId(`pickup:${fixture.slug}`), shopId, contactName: fixture.nameTh, ...address, type: "PICKUP", isDefault: true } });
  }
  return newBuyers;
}

async function seedCatalog(tx: Tx, products: UatProduct[]) {
  const categories = new Map<string, string>();
  for (const [index, fixture] of UAT_CATEGORIES.entries()) {
    const category = await tx.category.upsert({ where: { slug: fixture.slug }, update: {}, create: { id: uatId(`category:${fixture.slug}`), ...fixture, name: fixture.nameTh, sortOrder: index * 10 } });
    if (!category.nameTh || category.nameTh === category.nameEn) await tx.category.update({ where: { id: category.id }, data: { nameTh: fixture.nameTh } });
    categories.set(fixture.slug, category.id);
  }
  for (const [index, fixture] of UAT_SHOPS.entries()) {
    const id = uatId(`brand:${fixture.slug}`);
    if (await tx.brand.findUnique({ where: { id } })) continue;
    if (await tx.brand.findUnique({ where: { slug: fixture.slug } })) throw new Error(`UAT brand slug already exists ${fixture.slug}`);
    await tx.brand.create({ data: {
      id, slug: fixture.slug, name: fixture.nameTh, nameTh: fixture.nameTh, nameEn: fixture.nameEn,
      logoUrl: `/uat/brands/${fixture.slug}.svg`, countryCode: "TH", sortOrder: index * 10, isFeatured: true,
      descriptionTh: "แบรนด์สมมติสำหรับทดสอบ UAT", descriptionEn: "Fictional UAT testing brand.",
    } });
  }
  for (const fixture of products) {
    const id = uatId(`product:${fixture.slug}`);
    const shopId = uatId(`shop:${fixture.shopSlug}`);
    const sellerProfileId = uatId(`seller:${fixture.shopSlug}`);
    const existing = await tx.product.findUnique({ where: { id } });
    if (existing) {
      if (existing.shopId !== shopId || existing.sellerProfileId !== sellerProfileId) throw new Error(`UAT product ownership is inconsistent ${fixture.slug}`);
      continue;
    }
    if (await tx.product.findFirst({ where: { shopId, slug: fixture.slug } })) throw new Error(`UAT product slug already exists ${fixture.slug}`);
    await tx.product.create({ data: {
      id, shopId, sellerProfileId, categoryId: categories.get(fixture.categorySlug)!, brandId: uatId(`brand:${fixture.brandSlug}`),
      slug: fixture.slug, title: fixture.titleTh, titleTh: fixture.titleTh, titleEn: fixture.titleEn,
      description: fixture.descriptionTh, descriptionTh: fixture.descriptionTh, descriptionEn: fixture.descriptionEn,
      metaTitle: `${fixture.titleTh} | UAT`, metaDescription: fixture.descriptionTh,
      status: fixture.status, condition: "NEW", countryOfOrigin: "TH", warrantyInfo: "ข้อมูลสมมติสำหรับ UAT",
    } });
    for (const variant of fixture.variants) {
      await tx.productVariant.create({ data: {
        id: uatId(`variant:${variant.sku}`), productId: id, sku: variant.sku,
        title: variant.titleTh, titleTh: variant.titleTh, titleEn: variant.titleEn,
        price: BigInt(variant.priceMinor), currency: "THB", status: "ACTIVE", weightGrams: 500,
        inventory: { create: { id: uatId(`inventory:${variant.sku}`), quantityOnHand: variant.quantityOnHand, reorderLevel: variant.reorderLevel } },
      } });
    }
    if (fixture.variants.length > 1) {
      const optionId = uatId(`option:${fixture.slug}`);
      await tx.productOption.create({ data: { id: optionId, productId: id, name: "Size", nameEn: "Size", nameTh: "ไซซ์" } });
      for (const [index, variant] of fixture.variants.entries()) {
        const valueId = uatId(`option-value:${variant.sku}`);
        await tx.productOptionValue.create({ data: { id: valueId, optionId, value: variant.titleEn, valueEn: variant.titleEn, valueTh: variant.titleTh, sortOrder: index } });
        await tx.productVariantOptionValue.create({ data: { id: uatId(`variant-option:${variant.sku}`), variantId: uatId(`variant:${variant.sku}`), optionValueId: valueId } });
      }
    }
    for (const [index, image] of fixture.images.entries()) await tx.productImage.create({ data: { id: uatId(`image:${image.url}`), productId: id, url: image.url, altText: `${fixture.titleTh} / ${fixture.titleEn}`, width: image.width, height: image.height, sortOrder: index, isPrimary: index === 0 } });
    await tx.productHighlight.createMany({ data: [
      { id: uatId(`highlight:${fixture.slug}:1`), productId: id, text: "ข้อมูลสินค้าสมมติสำหรับ UAT / UAT sample listing", sortOrder: 0 },
      { id: uatId(`highlight:${fixture.slug}:2`), productId: id, text: "รูปสินค้าพร้อมใช้งานในเครื่อง / Local product photos", sortOrder: 1 },
    ] });
    await tx.productAttribute.create({ data: { id: uatId(`attribute:${fixture.slug}:purpose`), productId: id, attributeKey: "uat-purpose", displayName: "วัตถุประสงค์", displayNameTh: "วัตถุประสงค์", displayNameEn: "Purpose", value: "UAT", valueTh: "ทดสอบการยอมรับระบบ", valueEn: "Acceptance testing", isFilterable: false } });
    await tx.shop.update({ where: { id: shopId }, data: { productCount: { increment: 1 } } });
  }
}

async function seedCoupons(tx: Tx) {
  const common = { startsAt: new Date("2025-01-01T00:00:00Z"), endsAt: new Date("2035-01-01T00:00:00Z"), usageLimit: 1000, perUserLimit: 20 };
  const coupons = [
    { code: "UAT10", titleTh: "ลด 10% สูงสุด 200 บาท", titleEn: "10% off up to THB 200", discountType: "PERCENT", discountPercentBps: 1000, maxDiscount: 20000n, minOrder: 10000n },
    { code: "UATFASHION100", titleTh: "ร้านแฟชั่นลด 100 บาท", titleEn: "THB 100 off fashion", discountType: "FIXED_AMOUNT", discountValue: 10000n, minOrder: 50000n, shopId: uatId("shop:uat-fashion") },
    { code: "UATSHIP", titleTh: "ส่งฟรี", titleEn: "Free shipping", discountType: "FREE_SHIPPING", minOrder: 10000n },
    { code: "UATEXPIRED", titleTh: "คูปองหมดอายุ", titleEn: "Expired coupon", discountType: "FIXED_AMOUNT", discountValue: 1000n, startsAt: new Date("2020-01-01T00:00:00Z"), endsAt: new Date("2020-02-01T00:00:00Z") },
    { code: "UATMIN", titleTh: "ยอดขั้นต่ำ 10,000 บาท", titleEn: "Minimum spend THB 10,000", discountType: "FIXED_AMOUNT", discountValue: 10000n, minOrder: 1000000n },
  ] satisfies Prisma.CouponCreateManyInput[];
  for (const fixture of coupons) {
    const id = uatId(`coupon:${fixture.code}`);
    const coupon = await tx.coupon.upsert({ where: { code: fixture.code }, update: {}, create: { ...common, ...fixture, id } });
    if (coupon.id !== id) throw new Error(`UAT coupon code already exists ${fixture.code}`);
  }
}

async function seedStarters(tx: Tx, newBuyers: Set<string>, products: UatProduct[]) {
  for (const email of newBuyers) {
    const userId = uatId(`user:${email}`);
    const cartId = uatId(`cart:starter:${email}`);
    await tx.cart.create({ data: { id: cartId, userId, status: "ACTIVE" } });
    for (const shop of UAT_SHOPS.slice(0, 2)) {
      const product = products.find((product) => product.shopSlug === shop.slug && product.status === "ACTIVE" && product.variants[0]!.quantityOnHand > 0)!;
      const variant = product.variants[0]!;
      await tx.cartItem.create({ data: { id: uatId(`cart-item:${email}:${variant.sku}`), cartId, variantId: uatId(`variant:${variant.sku}`), quantity: 1, unitPrice: BigInt(variant.priceMinor), currency: "THB" } });
      await tx.favoriteProduct.create({ data: { id: uatId(`favorite:${email}:${product.slug}`), userId, productId: uatId(`product:${product.slug}`) } });
      await tx.shopFollow.create({ data: { id: uatId(`follow:${email}:${shop.slug}`), userId, shopId: uatId(`shop:${shop.slug}`) } });
      await tx.shop.update({ where: { id: uatId(`shop:${shop.slug}`) }, data: { followerCount: { increment: 1 } } });
    }
  }
}

async function seedInventoryHistory(tx: Tx, scenario: UatScenario, sku: string, quantity: number, expiresAt: Date) {
  const state = scenarioState(scenario);
  const inventoryId = uatId(`inventory:${sku}`);
  await tx.$queryRaw`SELECT "id" FROM "Inventory" WHERE "id" = ${inventoryId}::uuid FOR UPDATE`;
  const before = await tx.inventory.findUniqueOrThrow({ where: { id: inventoryId } });
  if (before.quantityOnHand - before.quantityReserved < quantity) throw new Error(`Not enough stock to add scenario ${scenario.orderNumber} / ${sku}`);
  const reserved = before.quantityReserved + quantity;
  const reservationId = uatId(`reservation:${scenario.orderNumber}:${sku}`);
  await tx.inventoryReservation.create({ data: { id: reservationId, checkoutId: uatId(`checkout:${scenario.orderNumber}`), orderId: uatId(`order:${scenario.orderNumber}`), inventoryId, quantity, status: state.reservationStatus, expiresAt } });
  await tx.inventoryMovement.create({ data: {
    id: uatId(`movement:reserve:${scenario.orderNumber}:${sku}`), inventoryId, variantId: before.variantId,
    type: "RESERVATION_CREATED", quantityDelta: 0, quantityOnHandBefore: before.quantityOnHand, quantityOnHandAfter: before.quantityOnHand,
    quantityReservedBefore: before.quantityReserved, quantityReservedAfter: reserved, referenceType: "UAT_FIXTURE_RESERVATION", referenceId: reservationId,
    reason: "UAT fixture reservation", metadata: { fixture: true, orderNumber: scenario.orderNumber },
  } });
  const onHand = before.quantityOnHand - (state.reservationStatus === "COMMITTED" ? quantity : 0);
  const quantityReserved = state.reservationStatus === "ACTIVE" ? reserved : before.quantityReserved;
  await tx.inventory.update({ where: { id: inventoryId }, data: { quantityOnHand: onHand, quantityReserved, version: { increment: 1 } } });
  if (state.reservationStatus !== "ACTIVE") await tx.inventoryMovement.create({ data: {
    id: uatId(`movement:terminal:${scenario.orderNumber}:${sku}`), inventoryId, variantId: before.variantId,
    type: state.reservationStatus === "COMMITTED" ? "RESERVATION_COMMITTED" : "RESERVATION_RELEASED", quantityDelta: onHand - before.quantityOnHand,
    quantityOnHandBefore: before.quantityOnHand, quantityOnHandAfter: onHand, quantityReservedBefore: reserved, quantityReservedAfter: quantityReserved,
    referenceType: "UAT_FIXTURE_RESERVATION", referenceId: reservationId, reason: "UAT fixture historical transition", metadata: { fixture: true, orderNumber: scenario.orderNumber },
  } });
}

type ReviewAsset = { url: string; width: number; height: number; sizeBytes: number };
async function seedScenario(tx: Tx, scenario: UatScenario, now: Date, reviewAssets: ReviewAsset[]) {
  const orderId = uatId(`order:${scenario.orderNumber}`);
  const existing = await tx.order.findUnique({ where: { orderNumber: scenario.orderNumber } });
  if (existing) {
    if (existing.id !== orderId) throw new Error(`UAT order number already exists ${scenario.orderNumber}`);
    return false;
  }
  const state = scenarioState(scenario);
  const userId = uatId(`user:${scenario.buyerEmail}`);
  const lines = [];
  for (const spec of scenario.lines) {
    const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: uatId(`variant:${spec.sku}`) }, include: { product: { include: { shop: true } } } });
    if (variant.status !== "ACTIVE" || variant.product.status !== "ACTIVE" || variant.product.deletedAt || variant.product.shop.status !== "ACTIVE") throw new Error(`Scenario ${scenario.orderNumber} needs available SKU ${spec.sku}`);
    lines.push({ variant, quantity: spec.quantity, unitPrice: variant.price, shopId: variant.product.shopId });
  }
  const totals = calculateUatTotals(lines);
  const cartId = uatId(`cart:${scenario.orderNumber}`);
  const checkoutId = uatId(`checkout:${scenario.orderNumber}`);
  const paymentId = uatId(`payment:${scenario.orderNumber}`);
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const purchasedAt = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const paidAt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const shippedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const deliveredAt = new Date(now.getTime() - 60 * 60 * 1000);
  const buyer = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  await tx.cart.create({ data: { id: cartId, userId, status: "CHECKED_OUT", createdAt: purchasedAt } });
  await tx.checkout.create({ data: { id: checkoutId, cartId, userId, ...totals, status: state.checkoutStatus, expiresAt, createdAt: purchasedAt } });
  await tx.order.create({ data: {
    id: orderId, checkoutId, userId, orderNumber: scenario.orderNumber, ...totals, status: state.status, paymentStatus: state.paymentStatus, createdAt: purchasedAt,
    shippingName: buyer.name, shippingPhone: address.phone, shippingLine1: address.line1, shippingLine2: address.line2,
    shippingCity: address.city, shippingRegion: address.region, shippingPostalCode: address.postalCode, shippingCountry: address.country,
  } });
  await tx.payment.create({ data: { id: paymentId, orderId, provider: "mock", providerIntentId: `uat-fixture:${scenario.orderNumber}`, status: state.paymentStatus, amount: totals.grandTotal, currency: "THB", paidAt: state.paymentStatus === "SUCCEEDED" ? paidAt : null, createdAt: purchasedAt } });
  if (state.paymentStatus !== "PENDING") await tx.paymentEvent.create({ data: {
    id: uatId(`payment-event:${scenario.orderNumber}`), paymentId, providerEventId: `uat-fixture:${scenario.orderNumber}:historical`,
    eventType: state.paymentStatus === "SUCCEEDED" ? "payment.paid" : "payment.failed", receivedAt: paidAt,
    payload: { fixture: true, evidence: "Historical UAT fixture, not a real provider verification", provider: "mock", orderId, paymentId, amount: totals.grandTotal.toString(), orderNumber: scenario.orderNumber },
  } });
  for (const shopId of [...new Set(lines.map((line) => line.shopId))].sort()) {
    const shopLines = lines.filter((line) => line.shopId === shopId);
    const shopTotals = calculateUatTotals(shopLines);
    const shopOrderId = uatId(`shop-order:${scenario.orderNumber}:${shopId}`);
    const fee = shopTotals.subtotal * BigInt(UAT_COMMISSION_BPS) / 10000n;
    await tx.shopOrder.create({ data: { id: shopOrderId, orderId, shopId, ...shopTotals, status: state.status, fulfillmentStatus: state.fulfillmentStatus, createdAt: purchasedAt } });
    await tx.shopSaleSnapshot.create({ data: {
      shopOrderId, policyVersion: 1, currency: "THB", commissionBase: shopTotals.subtotal, commissionBps: UAT_COMMISSION_BPS, originalCommission: fee,
      originalShipping: UAT_SHIPPING, buyerShipping: UAT_SHIPPING, sellerShippingWaiver: 0n, platformShippingSubsidy: 0n,
      taxRatePpm: 0, taxMode: "EXCLUSIVE", taxFundingBasis: "BUYER_AFTER_ALL_DISCOUNTS", taxableShipping: false,
      taxShippingBasis: "SELLER_SHIPPING_AFTER_WAIVER", taxRounding: "LINE_HALF_UP", taxCustodian: "SELLER", taxExclusiveFunding: "BUYER", taxPolicyRevision: "uat-zero-tax-policy-1",
      sellerGrossMerchandise: shopTotals.subtotal, sellerGrossShipping: UAT_SHIPPING, buyerShippingNet: UAT_SHIPPING, buyerShippingTax: 0n,
      platformShippingNet: 0n, platformShippingTax: 0n, includedTaxTotal: 0n, addedTaxTotal: 0n, reportedTaxTotal: 0n,
      recognizedAt: scenario.stage === "delivered" ? now : null,
    } });
    const shipmentId = uatId(`shipment:${scenario.orderNumber}:${shopId}`);
    if (state.shipmentStatus) await tx.shipment.create({ data: {
      id: shipmentId, orderId, shopId, status: state.shipmentStatus, createdAt: paidAt,
      carrier: ["SHIPPED", "DELIVERED"].includes(state.shipmentStatus) ? "UAT Express" : null,
      trackingNumber: ["SHIPPED", "DELIVERED"].includes(state.shipmentStatus) ? `UAT${scenario.orderNumber.slice(-4)}${shopId.slice(0, 6)}` : null,
      shippedAt: ["SHIPPED", "DELIVERED"].includes(state.shipmentStatus) ? shippedAt : null,
      deliveredAt: scenario.stage === "delivered" ? deliveredAt : null,
    } });
    for (const line of shopLines) {
      const itemId = uatId(`order-item:${scenario.orderNumber}:${line.variant.sku}`);
      const gross = line.unitPrice * BigInt(line.quantity);
      await tx.orderItem.create({ data: {
        id: itemId, orderId, shopId, variantId: line.variant.id, productTitle: line.variant.product.title, productSlug: line.variant.product.slug,
        variantTitle: line.variant.title, variantSku: line.variant.sku, shopName: line.variant.product.shop.name, shopSlug: line.variant.product.shop.slug,
        quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: gross, currency: "THB", fulfillmentStatus: state.fulfillmentStatus,
      } });
      await tx.itemSaleSnapshot.create({ data: {
        orderItemId: itemId, shopOrderId, originalQuantity: line.quantity, grossMerchandise: gross, sellerCouponDiscount: 0n, platformCouponDiscount: 0n,
        coinDiscount: 0n, buyerMerchandise: gross, buyerMerchandiseNet: gross, buyerMerchandiseTax: 0n,
        platformCouponNet: 0n, platformCouponTax: 0n, coinFundingNet: 0n, coinFundingTax: 0n, originalCashbackEligibleNet: gross, originalAffiliateEligibleNet: gross,
      } });
      if (state.shipmentStatus) await tx.shipmentItem.create({ data: { id: uatId(`shipment-item:${scenario.orderNumber}:${line.variant.sku}`), shipmentId, orderItemId: itemId, quantity: line.quantity } });
      await seedInventoryHistory(tx, scenario, line.variant.sku, line.quantity, expiresAt);
    }
    if (scenario.stage === "delivered") {
      const wallet = await tx.shopWallet.findUniqueOrThrow({ where: { shopId } });
      await tx.walletLedgerEntry.createMany({ data: [
        { id: uatId(`earning:${scenario.orderNumber}:${shopId}`), walletId: wallet.id, shopId, type: "order_earning", amount: shopTotals.grandTotal, currency: "THB", orderId, description: `Order earning for ${scenario.orderNumber}`, metadata: { fixture: true, settlementPolicyVersion: 1 } },
        { id: uatId(`fee:${scenario.orderNumber}:${shopId}`), walletId: wallet.id, shopId, type: "commission_fee", amount: -fee, currency: "THB", orderId, description: `Platform commission for ${scenario.orderNumber}`, metadata: { fixture: true, commissionBps: UAT_COMMISSION_BPS } },
      ] });
    }
  }
  if (state.paymentStatus === "SUCCEEDED") {
    const coins = totals.subtotal / 10000n;
    if (coins > 0n) {
      const wallet = await tx.buyerCoinWallet.upsert({ where: { userId }, update: { balance: { increment: coins }, lifetimeEarned: { increment: coins } }, create: { id: uatId(`coins:${scenario.buyerEmail}`), userId, balance: coins, lifetimeEarned: coins } });
      await tx.buyerCoinLedger.create({ data: { id: uatId(`cashback:${scenario.orderNumber}`), walletId: wallet.id, userId, orderId, type: "EARNED", status: "AVAILABLE", amount: coins, balanceAfter: wallet.balance, reason: "1% order cashback", referenceType: "ORDER_CASHBACK", referenceId: orderId, createdAt: paidAt } });
    }
  }
  if (scenario.stage === "delivered") {
    for (const asset of reviewAssets) await tx.upload.create({ data: { id: uatId(`review-upload:${asset.url}`), userId, usage: "REVIEW_IMAGE", status: "COMPLETED", key: asset.url.slice(1), fileName: asset.url.split("/").at(-1)!, contentType: "image/webp", fileSize: asset.sizeBytes, publicUrl: asset.url, completedAt: now } });
    const reviewId = uatId(`review:${scenario.orderNumber}`);
    const photo = reviewAssets[0]!;
    const homeItem = await tx.orderItem.findUniqueOrThrow({ where: { id: uatId(`order-item:${scenario.orderNumber}:UAT-43-1`) }, include: { variant: true } });
    await tx.review.create({ data: { id: reviewId, userId, productId: homeItem.variant.productId, orderItemId: homeItem.id, rating: 5, body: "รีวิวสมมติสำหรับ UAT / Seeded UAT review with a local sample image", status: "PUBLISHED", moderatedAt: now } });
    await tx.reviewMedia.create({ data: { id: uatId(`review-media:${scenario.orderNumber}`), reviewId, uploadedById: userId, type: "IMAGE", url: photo.url, width: photo.width, height: photo.height, mimeType: "image/webp", sizeBytes: photo.sizeBytes, altText: "รูปตัวอย่างรีวิว UAT / UAT sample review photo" } });
    const returnId = uatId(`return:${scenario.orderNumber}`);
    await tx.returnRequest.create({ data: { id: returnId, orderId, userId, shopId: uatId("shop:uat-home"), status: "REQUESTED", reason: "เปลี่ยนใจ / Changed mind", description: "คำขอคืน 1 ชิ้นสำหรับทดสอบการอนุมัติและคืนเงินบางส่วน", images: [UAT_REVIEW_ASSETS[0]] } });
    await tx.returnItem.create({ data: { id: uatId(`return-item:${scenario.orderNumber}`), returnRequestId: returnId, orderItemId: uatId(`order-item:${scenario.orderNumber}:UAT-43-1`), quantity: 1, condition: "unopened" } });
  }
  return true;
}

export async function seedUat(db: PrismaClient, products: UatProduct[], password = UAT_PASSWORD, resetPassword = false) {
  if (password.length < 8 || password.length > 128) throw new Error("SEED_UAT_PASSWORD must contain 8 through 128 characters");
  const reviewAssets = await Promise.all(UAT_REVIEW_ASSETS.map(async (url) => {
    const metadata = await sharp(assetPath(url)).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`Missing review dimensions ${url}`);
    return { url, width: metadata.width, height: metadata.height, sizeBytes: statSync(assetPath(url)).size };
  }));
  const passwordHash = await hashPassword(password);
  const now = new Date();
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1935761713, 1)`;
    const newBuyers = await seedAccounts(tx, passwordHash, resetPassword, now);
    await seedCatalog(tx, products);
    await seedCoupons(tx);
    await seedStarters(tx, newBuyers, products);
    const createdScenarios = [];
    for (const fixture of UAT_SCENARIOS) if (await seedScenario(tx, fixture, now, reviewAssets)) createdScenarios.push(fixture.orderNumber);
    return { createdScenarios, accounts: UAT_ACCOUNTS.length, products: products.length };
  }, { timeout: 120000, maxWait: 10000 });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--validate", "--allow-remote", "--allow-production"].includes(arg))) throw new Error("Unknown UAT seed argument");
  loadUatEnvironment();
  const products = await loadUatData();
  if (args.includes("--validate")) {
    appContext.logger.info("UAT catalog and local assets are valid", { products: products.length });
    return;
  }
  const connectionString = assertUatDatabase(process.env, args);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const explicitPassword = process.env.SEED_UAT_PASSWORD;
    const result = await seedUat(db, products, explicitPassword ?? UAT_PASSWORD, explicitPassword !== undefined);
    await seedProductImages(db);
    const cacheConfig = getCacheConfigFromEnv();
    const cacheClient = createRedisCacheClient(cacheConfig);
    if (cacheClient) {
      try {
        const cache = new CacheService(appContext, cacheConfig, cacheClient);
        const invalidation = new CacheInvalidation(cache);
        await invalidation.invalidateCatalogDiscoveryAndSearch();
        for (const shop of UAT_SHOPS) await invalidation.invalidateSellerDashboard(uatId(`shop:${shop.slug}`));
        for (const product of products) await cache.deleteByPattern(`${cache.keys.categoryList().split(":category:list")[0]}:product:detail:*:${uatId(`product:${product.slug}`)}`);
        if (!cache.isEnabled()) appContext.logger.warn("UAT saved; cache invalidation was unavailable. Existing entries expire at their configured TTL.");
      } finally { await cacheClient.quit?.().catch(() => appContext.logger.warn("UAT cache connection could not close cleanly")); }
    }
    appContext.logger.info("UAT seed complete; existing tester activity preserved", result);
  } finally { await db.$disconnect(); }
}

if (import.meta.main) main().catch((error: unknown) => {
  appContext.logger.error("UAT seed failed", { error: error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database URL]") : "Unknown error" });
  process.exitCode = 1;
});
