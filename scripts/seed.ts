import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashPassword } from "better-auth/crypto";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

type Prisma = Awaited<typeof import("#server/lib/prisma.ts")>["prisma"];

type SeedUser = {
  email: string;
  name: string;
  role: "USER" | "ADMIN";
};

const DEMO_PASSWORD = "DemoPass123!";

type SeedVariant = {
  sku: string;
  title: string;
  price: number;
  quantityOnHand: number;
  reorderLevel: number;
};

type SeedProduct = {
  categorySlug: string;
  title: string;
  slug: string;
  description: string;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  variants: SeedVariant[];
};

type SeedShop = {
  ownerEmail: string;
  name: string;
  slug: string;
  contactPhone: string;
  products: SeedProduct[];
};

type SeedContext = {
  users: Map<string, string>;
  addresses: Map<string, string>;
  shops: Map<string, { id: string; name: string; slug: string; ownerEmail: string }>;
  categories: Map<string, string>;
  products: Map<string, { id: string; title: string; slug: string; shopSlug: string }>;
  variants: Map<string, { id: string; sku: string; title: string; price: number; productSlug: string }>;
  wallets: Map<string, string>;
};

const users: SeedUser[] = [
  { email: "admin@example.com", name: "Demo Admin", role: "ADMIN" },
  { email: "buyer.demo@example.com", name: "Demo Buyer", role: "USER" },
  { email: "buyer.return@example.com", name: "Return Buyer", role: "USER" },
  { email: "seller-fashion@example.com", name: "Fashion Seller", role: "USER" },
  { email: "seller-gadget@example.com", name: "Gadget Seller", role: "USER" },
  { email: "seller-home@example.com", name: "Home Seller", role: "USER" },
];

const categories = [
  ["Fashion", "fashion", 10],
  ["Beauty", "beauty", 20],
  ["Gadgets", "gadgets", 30],
  ["Electronics", "electronics", 40],
  ["Home", "home", 50],
  ["Sports", "sports", 60],
  ["Kids", "kids", 70],
  ["Groceries", "groceries", 80],
  ["Pets", "pets", 90],
  ["Deals", "deals", 100],
  ["Books", "books", 110],
] as const;

const shops: SeedShop[] = [
  {
    ownerEmail: "seller-fashion@example.com",
    name: "Urban Thread Co.",
    slug: "urban-thread-co",
    contactPhone: "+66812345678",
    products: [
      product("fashion", "Everyday Oversized Cotton Tee", "everyday-oversized-cotton-tee", 790, ["Black S", "Black M", "White M"]),
      product("fashion", "Relaxed Linen Resort Shirt", "relaxed-linen-resort-shirt", 1290, ["Ivory M", "Navy L"]),
      product("fashion", "Wide-Leg Washed Denim Jeans", "wide-leg-washed-denim-jeans", 1890, ["Light 28", "Dark 32"]),
      product("sports", "High-Rise Active Leggings", "high-rise-active-leggings", 1590, ["Black S", "Cocoa M"]),
      product("fashion", "Canvas Mini Crossbody Bag", "canvas-mini-crossbody-bag", 990, ["Olive", "Natural"]),
      product("fashion", "Archive Sample Bomber Jacket", "archive-sample-bomber-jacket", 2590, ["Black M"], "ARCHIVED"),
      product("fashion", "Draft Pleated Skirt", "draft-pleated-skirt", 1190, ["Gray S"], "DRAFT"),
    ],
  },
  {
    ownerEmail: "seller-gadget@example.com",
    name: "Gadget Harbor",
    slug: "gadget-harbor",
    contactPhone: "+66812345679",
    products: [
      product("gadgets", "Magnetic Wireless Power Bank", "magnetic-wireless-power-bank", 1490, ["5000 mAh", "10000 mAh"]),
      product("electronics", "Noise Cancelling Earbuds Lite", "noise-cancelling-earbuds-lite", 2290, ["Black", "White"]),
      product("electronics", "USB-C Travel Dock 7-in-1", "usb-c-travel-dock-7-in-1", 1890, ["Space Gray"]),
      product("gadgets", "Smart Finder Tag", "smart-finder-tag", 690, ["Single", "Four Pack"]),
      product("electronics", "Portable Bluetooth Speaker", "portable-bluetooth-speaker", 1690, ["Graphite", "Coral"]),
      product("gadgets", "Draft Desk Charging Mat", "draft-desk-charging-mat", 1390, ["Walnut"], "DRAFT"),
      product("electronics", "Archived Action Camera Mount", "archived-action-camera-mount", 590, ["Standard"], "ARCHIVED"),
    ],
  },
  {
    ownerEmail: "seller-home@example.com",
    name: "Nest & Glow Market",
    slug: "nest-glow-market",
    contactPhone: "+66812345680",
    products: [
      product("beauty", "Hydrating Gel Cleanser", "hydrating-gel-cleanser", 590, ["150 ml", "300 ml"]),
      product("home", "Cotton Waffle Throw Blanket", "cotton-waffle-throw-blanket", 1490, ["Sage", "Cream"]),
      product("groceries", "Single Origin Drip Coffee Box", "single-origin-drip-coffee-box", 450, ["10 Bags", "30 Bags"]),
      product("pets", "Adjustable Pet Feeding Bowl", "adjustable-pet-feeding-bowl", 890, ["Small", "Large"]),
      product("kids", "Wooden Shape Sorting Toy", "wooden-shape-sorting-toy", 790, ["Natural"]),
      product("books", "Home Organization Planner", "home-organization-planner", 350, ["Paperback"]),
      product("home", "Draft Ceramic Aroma Diffuser", "draft-ceramic-aroma-diffuser", 990, ["White"], "DRAFT"),
    ],
  },
];

function product(
  categorySlug: string,
  title: string,
  slug: string,
  basePrice: number,
  variants: string[],
  status: "ACTIVE" | "DRAFT" | "ARCHIVED" = "ACTIVE",
): SeedProduct {
  const prefix = slug
    .split("-")
    .map((part) => part[0])
    .join("")
    .slice(0, 5)
    .toUpperCase();
  return {
    categorySlug,
    title,
    slug,
    description: `${title} seeded for marketplace demo workflows.`,
    status,
    variants: variants.map((variant, index) => ({
      sku: `${prefix}-${index + 1}`,
      title: variant,
      price: basePrice + index * 100,
      quantityOnHand: status === "ACTIVE" ? 30 + index * 7 : 5,
      reorderLevel: 5,
    })),
  };
}

async function upsertByFindFirst<T>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
  update: (id: string) => Promise<T>,
  getId: (row: T) => string,
) {
  const existing = await find();
  if (!existing) return create();
  return update(getId(existing));
}

async function main() {
  loadEnvLocal();
  const { prisma } = await import("#server/lib/prisma.ts");
  const ctx: SeedContext = {
    users: new Map(),
    addresses: new Map(),
    shops: new Map(),
    categories: new Map(),
    products: new Map(),
    variants: new Map(),
    wallets: new Map(),
  };

  await seedUsers(prisma, ctx);
  await seedCatalog(prisma, ctx);
  await seedCoupons(prisma, ctx);
  await seedEngagement(prisma, ctx);
  await seedCommerce(prisma, ctx);
  await seedUploadsAndAudit(prisma, ctx);

  console.log([
    "Seeded full marketplace demo data.",
    `users=${ctx.users.size}`,
    `shops=${ctx.shops.size}`,
    `products=${ctx.products.size}`,
    `variants=${ctx.variants.size}`,
  ].join(" "));
}

async function seedUsers(prisma: Prisma, ctx: SeedContext) {
  for (const seed of users) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {
        name: seed.name,
        role: seed.role,
        status: "ACTIVE",
        emailVerified: true,
      },
      create: {
        email: seed.email,
        name: seed.name,
        role: seed.role,
        status: "ACTIVE",
        emailVerified: true,
      },
    });
    ctx.users.set(seed.email, user.id);
    await ensureCredentialAccount(prisma, user.id);

    const address = await upsertByFindFirst(
      () => prisma.address.findFirst({ where: { userId: user.id, isDefault: true } }),
      () => prisma.address.create({ data: addressData(user.id, seed.name) }),
      (id) => prisma.address.update({ where: { id }, data: addressData(user.id, seed.name) }),
      (row) => row.id,
    );
    ctx.addresses.set(seed.email, address.id);
  }
}

async function ensureCredentialAccount(prisma: Prisma, userId: string) {
  const password = await hashPassword(DEMO_PASSWORD);
  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: userId,
      },
    },
    update: { userId, password },
    create: {
      userId,
      providerId: "credential",
      accountId: userId,
      password,
    },
  });
}

function addressData(userId: string, name: string) {
  return {
    userId,
    recipientName: name,
    phone: "+66812345678",
    line1: "88 Demo Commerce Road",
    line2: "Unit 12",
    city: "Bangkok",
    region: "Bangkok",
    postalCode: "10110",
    country: "TH",
    isDefault: true,
  };
}

async function seedCatalog(prisma: Prisma, ctx: SeedContext) {
  for (const [name, slug, sortOrder] of categories) {
    const category = await prisma.category.upsert({
      where: { slug },
      update: { name, nameTh: name, nameEn: name, sortOrder, isActive: true },
      create: { name, nameTh: name, nameEn: name, slug, sortOrder, isActive: true },
    });
    ctx.categories.set(slug, category.id);
  }

  for (const seed of shops) {
    const ownerId = required(ctx.users, seed.ownerEmail);
    // ensure a SellerProfile exists for the shop owner (schema requires sellerProfileId)
    const sellerProfile = await prisma.sellerProfile.upsert({
      where: { userId: ownerId },
      update: {},
      create: { userId: ownerId },
    });
    const shop = await upsertByFindFirst(
      () => prisma.shop.findFirst({ where: { slug: seed.slug } }),
      () =>
        prisma.shop.create({
          data: {
            ownerId,
            sellerProfileId: sellerProfile.id,
            name: seed.name,
            slug: seed.slug,
            status: "ACTIVE",
            contactEmail: seed.ownerEmail,
            contactPhone: seed.contactPhone,
          },
        }),
      (id) =>
        prisma.shop.update({
          where: { id },
          data: {
            ownerId,
            name: seed.name,
            status: "ACTIVE",
            sellerProfileId: sellerProfile.id,
            contactEmail: seed.ownerEmail,
            contactPhone: seed.contactPhone,
          },
        }),
      (row) => row.id,
    );
    ctx.shops.set(seed.slug, { id: shop.id, name: shop.name, slug: shop.slug, ownerEmail: seed.ownerEmail });

    const wallet = await prisma.shopWallet.upsert({
      where: { shopId: shop.id },
      update: { currency: "THB" },
      create: { shopId: shop.id, currency: "THB" },
    });
    ctx.wallets.set(seed.slug, wallet.id);

    for (const productSeed of seed.products) {
      const categoryId = required(ctx.categories, productSeed.categorySlug);
      const item = await upsertByFindFirst(
        () => prisma.product.findFirst({ where: { shopId: shop.id, slug: productSeed.slug } }),
        () =>
          prisma.product.create({
            data: {
              shopId: shop.id,
              categoryId,
              title: productSeed.title,
              titleTh: productSeed.title,
              titleEn: productSeed.title,
              slug: productSeed.slug,
              description: productSeed.description,
              descriptionTh: productSeed.description,
              descriptionEn: productSeed.description,
              status: productSeed.status ?? "ACTIVE",
            },
          }),
        (id) =>
          prisma.product.update({
            where: { id },
            data: {
              categoryId,
              title: productSeed.title,
              titleTh: productSeed.title,
              titleEn: productSeed.title,
              description: productSeed.description,
              descriptionTh: productSeed.description,
              descriptionEn: productSeed.description,
              status: productSeed.status ?? "ACTIVE",
            },
          }),
        (row) => row.id,
      );
      ctx.products.set(productSeed.slug, { id: item.id, title: item.title, slug: item.slug, shopSlug: shop.slug });

      for (const variantSeed of productSeed.variants) {
        const variant = await prisma.productVariant.upsert({
          where: { productId_sku: { productId: item.id, sku: variantSeed.sku } },
          update: {
            productId: item.id,
            title: variantSeed.title,
            titleTh: variantSeed.title,
            titleEn: variantSeed.title,
            price: BigInt(variantSeed.price),
            currency: "THB",
            status: "ACTIVE",
          },
          create: {
            productId: item.id,
            sku: variantSeed.sku,
            title: variantSeed.title,
            titleTh: variantSeed.title,
            titleEn: variantSeed.title,
            price: BigInt(variantSeed.price),
            currency: "THB",
            status: "ACTIVE",
          },
        });
        ctx.variants.set(variantSeed.sku, {
          id: variant.id,
          sku: variant.sku,
          title: variant.title,
          price: Number(variant.price),
          productSlug: productSeed.slug,
        });

        await prisma.inventory.upsert({
          where: { variantId: variant.id },
          update: {
            quantityOnHand: variantSeed.quantityOnHand,
            quantityReserved: 0,
            reorderLevel: variantSeed.reorderLevel,
          },
          create: {
            variantId: variant.id,
            quantityOnHand: variantSeed.quantityOnHand,
            quantityReserved: 0,
            reorderLevel: variantSeed.reorderLevel,
          },
        });
      }
    }
  }
}

async function seedCoupons(prisma: Prisma, ctx: SeedContext) {
  const fashionShopId = requiredShop(ctx, "urban-thread-co").id;
  const now = Date.now();
  const coupons = [
    {
      code: "DEMO10",
      shopId: null,
      titleTh: "Demo 10%",
      titleEn: "Demo 10%",
      discountType: "PERCENT" as const,
      discountPercentBps: 1000,
      discountValue: null,
      minOrder: 500,
      maxDiscount: 500,
      isActive: true,
      startsAt: new Date(now - 86_400_000),
      endsAt: new Date(now + 30 * 86_400_000),
    },
    {
      code: "FASHION200",
      shopId: fashionShopId,
      titleTh: "Fashion 200 off",
      titleEn: "Fashion 200 off",
      discountType: "FIXED_AMOUNT" as const,
      discountPercentBps: null,
      discountValue: 200,
      minOrder: 1000,
      maxDiscount: null,
      isActive: true,
      startsAt: new Date(now - 86_400_000),
      endsAt: new Date(now + 14 * 86_400_000),
    },
    {
      code: "EXPIRED5",
      shopId: null,
      titleTh: "Expired demo",
      titleEn: "Expired demo",
      discountType: "PERCENT" as const,
      discountPercentBps: 500,
      discountValue: null,
      minOrder: null,
      maxDiscount: null,
      isActive: false,
      startsAt: new Date(now - 30 * 86_400_000),
      endsAt: new Date(now - 86_400_000),
    },
  ];

  for (const coupon of coupons) {
    const upsertData = {
      ...coupon,
      descriptionTh: coupon.titleTh,
      descriptionEn: coupon.titleEn,
      usageLimit: 500,
      perUserLimit: 5,
      discountValue: coupon.discountValue ? BigInt(coupon.discountValue) : null,
      minOrder: coupon.minOrder ? BigInt(coupon.minOrder) : null,
      maxDiscount: coupon.maxDiscount ? BigInt(coupon.maxDiscount) : null,
    } as any;
    await prisma.coupon.upsert({ where: { code: coupon.code }, update: upsertData, create: upsertData });
  }
}

async function seedEngagement(prisma: Prisma, ctx: SeedContext) {
  const buyerId = required(ctx.users, "buyer.demo@example.com");
  const returnBuyerId = required(ctx.users, "buyer.return@example.com");
  const favoriteProductId = requiredProduct(ctx, "everyday-oversized-cotton-tee").id;
  const followedShopId = requiredShop(ctx, "gadget-harbor").id;

  await prisma.favoriteProduct.upsert({
    where: { userId_productId: { userId: buyerId, productId: favoriteProductId } },
    update: {},
    create: { userId: buyerId, productId: favoriteProductId },
  });
  await prisma.shopFollow.upsert({
    where: { userId_shopId: { userId: buyerId, shopId: followedShopId } },
    update: {},
    create: { userId: buyerId, shopId: followedShopId },
  });
  await prisma.shopFollow.upsert({
    where: { userId_shopId: { userId: returnBuyerId, shopId: requiredShop(ctx, "urban-thread-co").id } },
    update: {},
    create: { userId: returnBuyerId, shopId: requiredShop(ctx, "urban-thread-co").id },
  });
}

async function seedCommerce(prisma: Prisma, ctx: SeedContext) {
  await seedActiveCart(prisma, ctx);
  const pending = await seedOrderScenario(prisma, ctx, {
    buyerEmail: "buyer.demo@example.com",
    cartStatus: "CHECKED_OUT",
    orderNumber: "DEMO-PENDING-1001",
    checkoutStatus: "PAYMENT_PENDING",
    orderStatus: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    reservationStatus: "ACTIVE",
    items: [
      ["EOCT-2", 2],
      ["MWPB-1", 1],
    ],
    shipping: 500,
  });
  await setReservedQuantities(prisma, pending.reservations);

  const paid = await seedOrderScenario(prisma, ctx, {
    buyerEmail: "buyer.demo@example.com",
    cartStatus: "CHECKED_OUT",
    orderNumber: "DEMO-PAID-1002",
    checkoutStatus: "COMPLETED",
    orderStatus: "PAID",
    paymentStatus: "SUCCEEDED",
    reservationStatus: "COMMITTED",
    items: [
      ["RLRS-1", 1],
      ["MWPB-2", 1],
      ["PBS-1", 2],
    ],
    couponCode: "DEMO10",
    discount: 300,
    shipping: 500,
    paymentEventType: "payment.paid",
  });
  await seedShipments(prisma, paid.order.id, "PENDING_PACK");
  await seedCouponRedemption(prisma, paid.order.id, required(ctx.users, "buyer.demo@example.com"), "DEMO10");

  const shipped = await seedOrderScenario(prisma, ctx, {
    buyerEmail: "buyer.demo@example.com",
    cartStatus: "CHECKED_OUT",
    orderNumber: "DEMO-SHIPPED-1003",
    checkoutStatus: "COMPLETED",
    orderStatus: "SHIPPED",
    paymentStatus: "SUCCEEDED",
    reservationStatus: "COMMITTED",
    items: [
      ["NCEL-1", 1],
      ["CWTB-1", 1],
    ],
    shipping: 500,
    paymentEventType: "payment.paid",
  });
  await seedShipments(prisma, shipped.order.id, "SHIPPED");

  const delivered = await seedOrderScenario(prisma, ctx, {
    buyerEmail: "buyer.return@example.com",
    cartStatus: "CHECKED_OUT",
    orderNumber: "DEMO-DELIVERED-1004",
    checkoutStatus: "COMPLETED",
    orderStatus: "DELIVERED",
    paymentStatus: "SUCCEEDED",
    reservationStatus: "COMMITTED",
    items: [
      ["RLRS-2", 1],
      ["HGC-1", 2],
    ],
    shipping: 500,
    paymentEventType: "payment.paid",
  });
  await seedShipments(prisma, delivered.order.id, "DELIVERED");
  await seedReviewReturnRefund(prisma, ctx, delivered);

  const failed = await seedOrderScenario(prisma, ctx, {
    buyerEmail: "buyer.return@example.com",
    cartStatus: "CHECKED_OUT",
    orderNumber: "DEMO-FAILED-1005",
    checkoutStatus: "EXPIRED",
    orderStatus: "CANCELED",
    paymentStatus: "FAILED",
    reservationStatus: "RELEASED",
    items: [["UCTD7-1", 1]],
    shipping: 500,
    paymentEventType: "payment.failed",
  });
  await seedPaymentEvent(prisma, failed.payment.id, "DEMO-FAILED-1005", "payment.failed");

  await seedChatNotificationsWallets(prisma, ctx, paid.order.id, delivered.order.id);
}

async function seedActiveCart(prisma: Prisma, ctx: SeedContext) {
  const userId = required(ctx.users, "buyer.demo@example.com");
  const cart = await upsertByFindFirst(
    () => prisma.cart.findFirst({ where: { userId, status: "ACTIVE" } }),
    () => prisma.cart.create({ data: { userId, status: "ACTIVE" } }),
    (id) => prisma.cart.update({ where: { id }, data: { status: "ACTIVE" } }),
    (row) => row.id,
  );
  await upsertCartItem(prisma, cart.id, requiredVariant(ctx, "SFT-1"), 1);
  await upsertCartItem(prisma, cart.id, requiredVariant(ctx, "MWPB-1"), 1);
}

async function upsertCartItem(prisma: Prisma, cartId: string, variant: SeedContext["variants"] extends Map<string, infer T> ? T : never, quantity: number) {
  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId: variant.id } },
    update: { quantity, unitPrice: BigInt(variant.price), currency: "THB" },
    create: { cartId, variantId: variant.id, quantity, unitPrice: BigInt(variant.price), currency: "THB" },
  });
}

async function seedOrderScenario(
  prisma: Prisma,
  ctx: SeedContext,
  input: {
    buyerEmail: string;
    cartStatus: "CHECKED_OUT" | "ABANDONED";
    orderNumber: string;
    checkoutStatus: "PAYMENT_PENDING" | "COMPLETED" | "EXPIRED";
    orderStatus: "PENDING_PAYMENT" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELED";
    paymentStatus: "PENDING" | "SUCCEEDED" | "FAILED";
    reservationStatus: "ACTIVE" | "COMMITTED" | "RELEASED";
    items: Array<[string, number]>;
    shipping: number;
    discount?: number;
    couponCode?: string;
    paymentEventType?: "payment.paid" | "payment.failed";
  },
) {
  const userId = required(ctx.users, input.buyerEmail);
  const addressId = required(ctx.addresses, input.buyerEmail);
  const address = await prisma.address.findUniqueOrThrow({ where: { id: addressId } });
  const cart = await upsertByFindFirst(
    () => prisma.cart.findFirst({ where: { userId, items: { some: {} }, checkouts: { some: { order: { orderNumber: input.orderNumber } } } } }),
    () => prisma.cart.create({ data: { userId, status: input.cartStatus } }),
    (id) => prisma.cart.update({ where: { id }, data: { status: input.cartStatus } }),
    (row) => row.id,
  );

  let subtotal = 0;
  const orderItems = [];
  for (const [sku, quantity] of input.items) {
    const variant = requiredVariant(ctx, sku);
    subtotal += variant.price * quantity;
    await upsertCartItem(prisma, cart.id, variant, quantity);
    const product = requiredProduct(ctx, variant.productSlug);
    const shop = [...ctx.shops.values()].find((candidate) => candidate.slug === product.shopSlug);
    if (!shop) throw new Error(`Missing shop for product ${product.slug}`);
    const fulfillmentStatus: "DELIVERED" | "SHIPPED" | "PENDING" =
      input.orderStatus === "DELIVERED" ? "DELIVERED" : input.orderStatus === "SHIPPED" ? "SHIPPED" : "PENDING";
    orderItems.push({
      shopId: shop.id,
      variantId: variant.id,
      productTitle: product.title,
      productSlug: product.slug,
      variantTitle: variant.title,
      variantSku: variant.sku,
      shopName: shop.name,
      shopSlug: shop.slug,
      quantity,
      unitPrice: variant.price,
      lineTotal: variant.price * quantity,
      currency: "THB",
      fulfillmentStatus,
    });
  }

  const discountTotal = input.discount ?? 0;
  const grandTotal = subtotal - discountTotal + input.shipping;
  const checkoutData = {
    cartId: cart.id,
    userId,
    status: input.checkoutStatus,
    subtotal: BigInt(subtotal),
    discountTotal: BigInt(discountTotal),
    shippingTotal: BigInt(input.shipping),
    taxTotal: BigInt(0),
    grandTotal: BigInt(grandTotal),
    currency: "THB",
    expiresAt: new Date(Date.now() + 15 * 60_000),
  } as any;
  const checkout = await upsertByFindFirst(
    () => prisma.checkout.findFirst({ where: { cartId: cart.id } }),
    () => prisma.checkout.create({ data: checkoutData }),
    (id) => prisma.checkout.update({ where: { id }, data: checkoutData }),
    (row) => row.id,
  );

  await prisma.inventoryReservation.deleteMany({ where: { checkoutId: checkout.id } });
  const reservations = [];
  for (const [sku, quantity] of input.items) {
    const variant = requiredVariant(ctx, sku);
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
    reservations.push(
      await prisma.inventoryReservation.create({
        data: {
          checkoutId: checkout.id,
          inventoryId: inventory.id,
          quantity,
          status: input.reservationStatus,
          expiresAt: new Date(Date.now() + 15 * 60_000),
        },
      }),
    );
  }

  const order = await prisma.order.upsert({
    where: { orderNumber: input.orderNumber },
    update: {
      checkoutId: checkout.id,
      userId,
      status: input.orderStatus,
      paymentStatus: input.paymentStatus,
      subtotal: BigInt(subtotal),
      discountTotal: BigInt(discountTotal),
      shippingTotal: BigInt(input.shipping),
      taxTotal: BigInt(0),
      grandTotal: BigInt(grandTotal),
      currency: "THB",
      shippingName: address.recipientName,
      shippingPhone: address.phone,
      shippingLine1: address.line1,
      shippingLine2: address.line2,
      shippingCity: address.city,
      shippingRegion: address.region,
      shippingPostalCode: address.postalCode,
      shippingCountry: address.country,
    },
    create: {
      checkoutId: checkout.id,
      userId,
      orderNumber: input.orderNumber,
      status: input.orderStatus,
      paymentStatus: input.paymentStatus,
      subtotal: BigInt(subtotal),
      discountTotal: BigInt(discountTotal),
      shippingTotal: BigInt(input.shipping),
      taxTotal: BigInt(0),
      grandTotal: BigInt(grandTotal),
      currency: "THB",
      shippingName: address.recipientName,
      shippingPhone: address.phone,
      shippingLine1: address.line1,
      shippingLine2: address.line2,
      shippingCity: address.city,
      shippingRegion: address.region,
      shippingPostalCode: address.postalCode,
      shippingCountry: address.country,
    },
  });

  await prisma.shipmentItem.deleteMany({ where: { orderItem: { orderId: order.id } } });
  await prisma.review.deleteMany({ where: { orderItem: { orderId: order.id } } });
  await prisma.returnItem.deleteMany({ where: { orderItem: { orderId: order.id } } });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  const createdItems = [];
  for (const item of orderItems) {
    createdItems.push(
      await prisma.orderItem.create({ data: { ...item, unitPrice: BigInt(item.unitPrice), lineTotal: BigInt(item.lineTotal), orderId: order.id } }),
    );
  }

  const payment = await prisma.payment.upsert({
    where: { providerIntentId: `demo_${input.orderNumber}` },
    update: {
      orderId: order.id,
      provider: "mock",
      status: input.paymentStatus,
      amount: BigInt(grandTotal),
      currency: "THB",
      paidAt: input.paymentStatus === "SUCCEEDED" ? new Date() : null,
    },
    create: {
      orderId: order.id,
      provider: "mock",
      providerIntentId: `demo_${input.orderNumber}`,
      status: input.paymentStatus,
      amount: BigInt(grandTotal),
      currency: "THB",
      paidAt: input.paymentStatus === "SUCCEEDED" ? new Date() : null,
    },
  });

  if (input.paymentEventType) await seedPaymentEvent(prisma, payment.id, input.orderNumber, input.paymentEventType);

  return { cart, checkout, order, payment, orderItems: createdItems, reservations };
}

async function seedPaymentEvent(prisma: Prisma, paymentId: string, orderNumber: string, eventType: string) {
  await prisma.paymentEvent.upsert({
    where: { providerEventId: `evt_${orderNumber}_${eventType}` },
    update: {
      paymentId,
      eventType,
      payload: { provider: "mock", orderNumber, eventType },
    },
    create: {
      paymentId,
      providerEventId: `evt_${orderNumber}_${eventType}`,
      eventType,
      payload: { provider: "mock", orderNumber, eventType },
    },
  });
}

async function setReservedQuantities(prisma: Prisma, reservations: Array<any>) {
  for (const reservation of reservations) {
    // reservations created from seedOrderScenario contain inventoryId
    if (reservation.status !== "ACTIVE") continue;
    const inventoryId = reservation.inventoryId ?? reservation.inventory?.id ?? reservation.variantId;
    await prisma.inventory.update({
      where: { id: inventoryId },
      data: { quantityReserved: reservation.quantity },
    });
  }
}

async function seedShipments(prisma: Prisma, orderId: string, status: "PENDING_PACK" | "SHIPPED" | "DELIVERED") {
  const orderItems = await prisma.orderItem.findMany({ where: { orderId } });
  const shopIds = [...new Set(orderItems.map((item) => item.shopId))];
  for (const shopId of shopIds) {
    const shipment = await prisma.shipment.upsert({
      where: { orderId_shopId: { orderId, shopId } },
      update: {
        status,
        carrier: status === "PENDING_PACK" ? null : "Demo Express",
        trackingNumber: status === "PENDING_PACK" ? null : `DEMO${orderId.slice(0, 8)}${shopId.slice(0, 4)}`,
        shippedAt: status === "PENDING_PACK" ? null : new Date(),
        deliveredAt: status === "DELIVERED" ? new Date() : null,
      },
      create: {
        orderId,
        shopId,
        status,
        carrier: status === "PENDING_PACK" ? null : "Demo Express",
        trackingNumber: status === "PENDING_PACK" ? null : `DEMO${orderId.slice(0, 8)}${shopId.slice(0, 4)}`,
        shippedAt: status === "PENDING_PACK" ? null : new Date(),
        deliveredAt: status === "DELIVERED" ? new Date() : null,
      },
    });
    for (const item of orderItems.filter((candidate) => candidate.shopId === shopId)) {
      await prisma.shipmentItem.upsert({
        where: { shipmentId_orderItemId: { shipmentId: shipment.id, orderItemId: item.id } },
        update: { quantity: item.quantity },
        create: { shipmentId: shipment.id, orderItemId: item.id, quantity: item.quantity },
      });
    }
  }
}

async function seedCouponRedemption(prisma: Prisma, orderId: string, userId: string, code: string) {
  const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code } });
  await prisma.couponRedemption.upsert({
    where: { couponId_orderId: { couponId: coupon.id, orderId } },
    update: { userId },
    create: { couponId: coupon.id, orderId, userId },
  });
}

async function seedReviewReturnRefund(
  prisma: Prisma,
  ctx: SeedContext,
  scenario: Awaited<ReturnType<typeof seedOrderScenario>>,
) {
  const buyerId = required(ctx.users, "buyer.return@example.com");
  const firstItem = scenario.orderItems[0];
  const product = await prisma.product.findFirstOrThrow({ where: { slug: firstItem.productSlug, shopId: firstItem.shopId } });
  const review = await prisma.review.upsert({
    where: { orderItemId: firstItem.id },
    update: {
      userId: buyerId,
      productId: product.id,
      rating: 5,
      body: "Delivered quickly and matched the listing.",
      status: "PUBLISHED",
    },
    create: {
      userId: buyerId,
      productId: product.id,
      orderItemId: firstItem.id,
      rating: 5,
      body: "Delivered quickly and matched the listing.",
      status: "PUBLISHED",
    },
  });

  const existingMedia = await prisma.reviewMedia.findFirst({ where: { reviewId: review.id, url: "https://example.com/demo/review-1.jpg" } });
  if (!existingMedia) {
    await prisma.reviewMedia.create({
      data: {
        reviewId: review.id,
        uploadedById: buyerId,
        type: "IMAGE",
        url: "https://example.com/demo/review-1.jpg",
      },
    });
  }

  const returnRequest = await upsertByFindFirst(
    () => prisma.returnRequest.findFirst({ where: { orderId: scenario.order.id, userId: buyerId } }),
    () => prisma.returnRequest.create({ data: { orderId: scenario.order.id, shopId: firstItem.shopId, userId: buyerId, status: "APPROVED", reason: "Changed mind", description: "Demo approved return." } }),
    (id) => prisma.returnRequest.update({ where: { id }, data: { status: "APPROVED", reason: "Changed mind", description: "Demo approved return." } }),
    (row) => row.id,
  );
  await prisma.returnItem.upsert({
    where: { returnRequestId_orderItemId: { returnRequestId: returnRequest.id, orderItemId: firstItem.id } },
    update: { quantity: 1, condition: "unopened" },
    create: { returnRequestId: returnRequest.id, orderItemId: firstItem.id, quantity: 1, condition: "unopened" },
  });

  const refund = await prisma.refund.upsert({
    where: { returnRequestId: returnRequest.id },
    update: {
      orderId: scenario.order.id,
      paymentId: scenario.payment.id,
      status: "SUCCESS",
      amount: BigInt(Number(firstItem.unitPrice)),
      reason: "Approved return refund",
    },
    create: {
      orderId: scenario.order.id,
      paymentId: scenario.payment.id,
      returnRequestId: returnRequest.id,
      status: "SUCCESS",
      amount: BigInt(Number(firstItem.unitPrice)),
      reason: "Approved return refund",
    },
  });

  await seedWalletEntry(prisma, ctx, firstItem.shopSlug, {
    type: "refund_adjustment",
    amount: -Number(firstItem.unitPrice),
    orderId: scenario.order.id,
    refundId: refund.id,
    description: "Demo refund adjustment",
  });
}

async function seedChatNotificationsWallets(prisma: Prisma, ctx: SeedContext, paidOrderId: string, deliveredOrderId: string) {
  const buyerId = required(ctx.users, "buyer.demo@example.com");
  const shop = requiredShop(ctx, "urban-thread-co");
  const thread = await prisma.chatThread.upsert({
    where: { buyerId_shopId: { buyerId, shopId: shop.id } },
    update: {},
    create: { buyerId, shopId: shop.id },
  });
  await seedChatMessage(
    prisma,
    thread.id,
    buyerId,
    "Hi, when will this order ship?",
    "demo-chat-buyer-1",
    {
      productId: requiredProduct(ctx, "everyday-oversized-cotton-tee").id,
      orderId: paidOrderId,
    },
  );
  await seedChatMessage(prisma, thread.id, required(ctx.users, shop.ownerEmail), "We are packing it today.", "demo-chat-seller-1");

  for (const [userEmail, type, title] of [
    ["buyer.demo@example.com", "ORDER_PAID", "Payment received"],
    [shop.ownerEmail, "SHIPMENT_READY", "New shipment ready"],
    ["buyer.return@example.com", "REFUND_SUCCESS", "Refund completed"],
  ] as const) {
    await upsertByFindFirst(
      () => prisma.notification.findFirst({ where: { userId: required(ctx.users, userEmail), type, title } }),
      () => prisma.notification.create({ data: { userId: required(ctx.users, userEmail), type, title, body: "Seeded demo notification.", data: { seeded: true } } }),
      (id) => prisma.notification.update({ where: { id }, data: { body: "Seeded demo notification.", data: { seeded: true } } }),
      (row) => row.id,
    );
  }

  await seedWalletEntry(prisma, ctx, "urban-thread-co", { type: "order_earning", amount: 2080, orderId: paidOrderId, description: "Demo paid order earning" });
  await seedWalletEntry(prisma, ctx, "urban-thread-co", { type: "commission_fee", amount: -208, orderId: paidOrderId, description: "Demo platform commission" });
  await seedWalletEntry(prisma, ctx, "gadget-harbor", { type: "order_earning", amount: 2390, orderId: paidOrderId, description: "Demo paid order earning" });
  await seedWalletEntry(prisma, ctx, "nest-glow-market", { type: "order_earning", amount: 1490, orderId: deliveredOrderId, description: "Demo delivered order earning" });

  await seedPayouts(prisma, ctx);
}

async function seedChatMessage(
  prisma: Prisma,
  threadId: string,
  senderId: string,
  body: string,
  marker: string,
  opts?: { productId?: string; orderId?: string },
) {
  await upsertByFindFirst(
    () => prisma.chatMessage.findFirst({ where: { threadId, body: { contains: marker } } }),
    () =>
      prisma.chatMessage.create({
        data: {
          threadId,
          senderId,
          messageType: "TEXT",
          body: `${body} [${marker}]`,
          productId: opts?.productId ?? undefined,
          orderId: opts?.orderId ?? undefined,
        },
      }),
    (id) =>
      prisma.chatMessage.update({
        where: { id },
        data: {
          senderId,
          body: `${body} [${marker}]`,
          ...(opts?.productId ? { productId: opts.productId } : {}),
          ...(opts?.orderId ? { orderId: opts.orderId } : {}),
        },
      }),
    (row) => row.id,
  );
}

async function seedWalletEntry(
  prisma: Prisma,
  ctx: SeedContext,
  shopSlug: string,
  input: {
    type: "order_earning" | "commission_fee" | "refund_adjustment" | "payout_reserved" | "payout_paid" | "payout_rejected" | "manual_adjustment";
    amount: number;
    orderId?: string;
    payoutId?: string;
    refundId?: string;
    description: string;
  },
) {
  const shop = requiredShop(ctx, shopSlug);
  const walletId = required(ctx.wallets, shopSlug);
  await upsertByFindFirst(
    () => prisma.walletLedgerEntry.findFirst({
      where: {
        walletId,
        type: input.type,
        orderId: input.orderId ?? null,
        payoutId: input.payoutId ?? null,
        refundId: input.refundId ?? null,
        description: input.description,
      },
    }),
    () => prisma.walletLedgerEntry.create({ data: { walletId, shopId: shop.id, currency: "THB", metadata: { seeded: true }, type: input.type, amount: BigInt(input.amount), orderId: input.orderId ?? null, payoutId: input.payoutId ?? null, refundId: input.refundId ?? null, description: input.description } }),
    (id) => prisma.walletLedgerEntry.update({ where: { id }, data: { amount: BigInt(input.amount), description: input.description, metadata: { seeded: true } } }),
    (row) => row.id,
  );
}

async function seedPayouts(prisma: Prisma, ctx: SeedContext) {
  const adminId = required(ctx.users, "admin@example.com");
  const sellerId = required(ctx.users, "seller-fashion@example.com");
  const shop = requiredShop(ctx, "urban-thread-co");
  const walletId = required(ctx.wallets, "urban-thread-co");

  const requested = await upsertByFindFirst(
    () => prisma.sellerPayout.findFirst({ where: { walletId, amount: BigInt(500), requestedById: sellerId, status: "requested" } }),
    () => prisma.sellerPayout.create({ data: { walletId, shopId: shop.id, amount: BigInt(500), currency: "THB", status: "requested", requestedById: sellerId } }),
    (id) => prisma.sellerPayout.update({ where: { id }, data: { amount: BigInt(500), status: "requested" } }),
    (row) => row.id,
  );
  await seedWalletEntry(prisma, ctx, "urban-thread-co", { type: "payout_reserved", amount: -500, payoutId: requested.id, description: "Demo requested payout reserve" });

  const paid = await upsertByFindFirst(
    () => prisma.sellerPayout.findFirst({ where: { walletId, amount: BigInt(300), requestedById: sellerId, status: "paid" } }),
    () => prisma.sellerPayout.create({ data: { walletId, shopId: shop.id, amount: BigInt(300), currency: "THB", status: "paid", requestedById: sellerId, approvedById: adminId, paidById: adminId, approvedAt: new Date(), paidAt: new Date() } }),
    (id) => prisma.sellerPayout.update({ where: { id }, data: { status: "paid", approvedById: adminId, paidById: adminId, approvedAt: new Date(), paidAt: new Date() } }),
    (row) => row.id,
  );
  await seedWalletEntry(prisma, ctx, "urban-thread-co", { type: "payout_paid", amount: 0, payoutId: paid.id, description: "Demo paid payout marker" });
}

async function seedUploadsAndAudit(prisma: Prisma, ctx: SeedContext) {
  const sellerId = required(ctx.users, "seller-fashion@example.com");
  const buyerId = required(ctx.users, "buyer.return@example.com");
  const adminId = required(ctx.users, "admin@example.com");
  const uploads = [
    { userId: sellerId, usage: "PRODUCT_IMAGE" as const, key: "demo/products/tee-main.jpg", fileName: "tee-main.jpg", publicUrl: "https://example.com/demo/products/tee-main.jpg" },
    { userId: sellerId, usage: "SHOP_IMAGE" as const, key: "demo/shops/urban-thread.jpg", fileName: "urban-thread.jpg", publicUrl: "https://example.com/demo/shops/urban-thread.jpg" },
    { userId: buyerId, usage: "REVIEW_IMAGE" as const, key: "demo/reviews/review-1.jpg", fileName: "review-1.jpg", publicUrl: "https://example.com/demo/reviews/review-1.jpg" },
  ];
  for (const upload of uploads) {
    await prisma.upload.upsert({
      where: { key: upload.key },
      update: { ...upload, status: "COMPLETED", contentType: "image/jpeg", fileSize: 120_000, completedAt: new Date() },
      create: { ...upload, status: "COMPLETED", contentType: "image/jpeg", fileSize: 120_000, completedAt: new Date() },
    });
  }

  for (const [action, entityType, entityId] of [
    ["ADMIN_LOGIN", "User", adminId],
    ["SHOP_STATUS_CHANGED", "Shop", requiredShop(ctx, "urban-thread-co").id],
    ["PRODUCT_STATUS_CHANGED", "Product", requiredProduct(ctx, "draft-pleated-skirt").id],
  ] as const) {
    await upsertByFindFirst(
      () => prisma.auditLog.findFirst({ where: { actorUserId: adminId, action, entityType, entityId } }),
      () => prisma.auditLog.create({ data: { actorUserId: adminId, actorRole: "ADMIN", action, entityType, entityId, metadata: { seeded: true } } }),
      (id) => prisma.auditLog.update({ where: { id }, data: { metadata: { seeded: true } } }),
      (row) => row.id,
    );
  }
}

function required(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Missing seeded value for ${key}`);
  return value;
}

function requiredShop(ctx: SeedContext, slug: string) {
  const value = ctx.shops.get(slug);
  if (!value) throw new Error(`Missing seeded shop ${slug}`);
  return value;
}

function requiredProduct(ctx: SeedContext, slug: string) {
  const value = ctx.products.get(slug);
  if (!value) throw new Error(`Missing seeded product ${slug}`);
  return value;
}

function requiredVariant(ctx: SeedContext, sku: string) {
  const value = ctx.variants.get(sku);
  if (!value) throw new Error(`Missing seeded variant ${sku}`);
  return value;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("#server/lib/prisma.ts");
    await prisma.$disconnect();
  });
