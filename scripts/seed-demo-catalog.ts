import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bootstrapBrands, bootstrapCategories, seedBootstrapMasterData, validateBootstrapMasterSeedData } from "./seed-bootstrap-master.ts";

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

type DemoVariant = {
  sku: string;
  title: string;
  price: number;
  quantityOnHand: number;
  reorderLevel: number;
};

type DemoProduct = {
  categorySlug: string;
  brandSlug: string;
  title: string;
  slug: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  warrantyInfo: string;
  condition: string;
  countryOfOrigin: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  variants: DemoVariant[];
  images: Array<{ url: string; altText: string; sortOrder: number; isPrimary: boolean; width: number; height: number }>;
  highlights: string[];
  attributes: Array<{
    attributeKey: string;
    displayName: string;
    value: string;
    sortOrder: number;
    isFilterable: boolean;
  }>;
};

type DemoSeller = {
  email: string;
  name: string;
  shop: {
    name: string;
    slug: string;
    contactPhone: string;
  };
  products: DemoProduct[];
};

export const demoCatalogSellers: DemoSeller[] = [
  {
    email: "seller-fashion-a@example.com",
    name: "Seller Fashion A",
    shop: {
      name: "Urban Thread Co.",
      slug: "urban-thread-co",
      contactPhone: "+66812345681",
    },
    products: [
      {
        categorySlug: "fashion",
        brandSlug: "urban-thread",
        title: "Everyday Oversized Cotton Tee",
        slug: "everyday-oversized-cotton-tee",
        description: "Heavyweight cotton tee with a relaxed streetwear fit.",
        metaTitle: "Everyday Oversized Cotton Tee | Urban Thread",
        metaDescription: "Shop a heavyweight oversized cotton tee with rich color variants and local inventory.",
        warrantyInfo: "7-day seller warranty for manufacturing defects.",
        condition: "NEW",
        countryOfOrigin: "TH",
        status: "ACTIVE",
        variants: [
          { sku: "UTC-TEE-BLK-S", title: "Black / S", price: 790, quantityOnHand: 32, reorderLevel: 8 },
          { sku: "UTC-TEE-BLK-M", title: "Black / M", price: 790, quantityOnHand: 46, reorderLevel: 8 },
          { sku: "UTC-TEE-WHT-M", title: "White / M", price: 750, quantityOnHand: 41, reorderLevel: 8 },
        ],
        images: [
          {
            url: "https://example.com/demo/products/everyday-oversized-cotton-tee-main.jpg",
            altText: "Black oversized cotton tee front view",
            sortOrder: 0,
            isPrimary: true,
            width: 1200,
            height: 1200,
          },
          {
            url: "https://example.com/demo/products/everyday-oversized-cotton-tee-fit.jpg",
            altText: "Oversized cotton tee relaxed fit detail",
            sortOrder: 1,
            isPrimary: false,
            width: 1200,
            height: 1200,
          },
        ],
        highlights: ["Heavyweight 240gsm cotton jersey", "Relaxed drop-shoulder silhouette", "Pre-shrunk for everyday washing"],
        attributes: [
          { attributeKey: "material", displayName: "Material", value: "Cotton", sortOrder: 0, isFilterable: true },
          { attributeKey: "fit", displayName: "Fit", value: "Oversized", sortOrder: 1, isFilterable: true },
          { attributeKey: "care", displayName: "Care", value: "Machine wash cold", sortOrder: 2, isFilterable: false },
        ],
      },
      {
        categorySlug: "fashion",
        brandSlug: "sming-basics",
        title: "Relaxed Linen Resort Shirt",
        slug: "relaxed-linen-resort-shirt",
        description: "Breathable linen blend shirt with resort-ready texture.",
        metaTitle: "Relaxed Linen Resort Shirt | Sming Basics",
        metaDescription: "A breathable linen blend shirt with practical variants for warm weather.",
        warrantyInfo: "7-day seller warranty for manufacturing defects.",
        condition: "NEW",
        countryOfOrigin: "TH",
        status: "ACTIVE",
        variants: [
          { sku: "UTC-LIN-IVR-M", title: "Ivory / M", price: 1290, quantityOnHand: 18, reorderLevel: 5 },
          { sku: "UTC-LIN-NVY-L", title: "Navy / L", price: 1390, quantityOnHand: 9, reorderLevel: 5 },
        ],
        images: [
          {
            url: "https://example.com/demo/products/relaxed-linen-resort-shirt-main.jpg",
            altText: "Ivory relaxed linen resort shirt",
            sortOrder: 0,
            isPrimary: true,
            width: 1200,
            height: 1200,
          },
        ],
        highlights: ["Linen blend fabric with soft drape", "Camp collar and straight hem", "Designed for warm weather layering"],
        attributes: [
          { attributeKey: "material", displayName: "Material", value: "Linen blend", sortOrder: 0, isFilterable: true },
          { attributeKey: "sleeve_length", displayName: "Sleeve Length", value: "Short sleeve", sortOrder: 1, isFilterable: true },
          { attributeKey: "closure", displayName: "Closure", value: "Button", sortOrder: 2, isFilterable: false },
        ],
      },
    ],
  },
  {
    email: "seller-gadget-a@example.com",
    name: "Seller Gadget A",
    shop: {
      name: "Gadget Harbor",
      slug: "gadget-harbor",
      contactPhone: "+66812345682",
    },
    products: [
      {
        categorySlug: "gadgets",
        brandSlug: "gadget-harbor",
        title: "Magnetic Wireless Power Bank",
        slug: "magnetic-wireless-power-bank",
        description: "Compact magnetic power bank for phones and daily carry.",
        metaTitle: "Magnetic Wireless Power Bank | Gadget Harbor",
        metaDescription: "A compact wireless power bank with capacity variants and ready stock.",
        warrantyInfo: "1-year limited electronics warranty.",
        condition: "NEW",
        countryOfOrigin: "CN",
        status: "ACTIVE",
        variants: [
          { sku: "GH-MWPB-5K", title: "5000 mAh", price: 1490, quantityOnHand: 35, reorderLevel: 8 },
          { sku: "GH-MWPB-10K", title: "10000 mAh", price: 1990, quantityOnHand: 22, reorderLevel: 6 },
        ],
        images: [
          {
            url: "https://example.com/demo/products/magnetic-wireless-power-bank-main.jpg",
            altText: "Magnetic wireless power bank attached to phone",
            sortOrder: 0,
            isPrimary: true,
            width: 1200,
            height: 1200,
          },
        ],
        highlights: ["Magnetic alignment for compatible phones", "USB-C input and output", "LED capacity indicator"],
        attributes: [
          { attributeKey: "capacity", displayName: "Capacity", value: "10000 mAh", sortOrder: 0, isFilterable: true },
          { attributeKey: "charging_type", displayName: "Charging Type", value: "Wireless", sortOrder: 1, isFilterable: true },
          { attributeKey: "connector", displayName: "Connector", value: "USB-C", sortOrder: 2, isFilterable: true },
        ],
      },
    ],
  },
  {
    email: "seller-home-a@example.com",
    name: "Seller Home A",
    shop: {
      name: "Nest & Glow Market",
      slug: "nest-glow-market",
      contactPhone: "+66812345683",
    },
    products: [
      {
        categorySlug: "home",
        brandSlug: "nest-glow",
        title: "Cotton Waffle Throw Blanket",
        slug: "cotton-waffle-throw-blanket",
        description: "Textured cotton throw blanket for sofa and bedroom styling.",
        metaTitle: "Cotton Waffle Throw Blanket | Nest & Glow",
        metaDescription: "A textured cotton throw blanket with color variants and home styling specs.",
        warrantyInfo: "7-day seller warranty for manufacturing defects.",
        condition: "NEW",
        countryOfOrigin: "TH",
        status: "ACTIVE",
        variants: [
          { sku: "NG-WAFFLE-SAGE", title: "Sage", price: 1490, quantityOnHand: 20, reorderLevel: 5 },
          { sku: "NG-WAFFLE-CREAM", title: "Cream", price: 1490, quantityOnHand: 17, reorderLevel: 5 },
        ],
        images: [
          {
            url: "https://example.com/demo/products/cotton-waffle-throw-blanket-main.jpg",
            altText: "Sage cotton waffle throw blanket on sofa",
            sortOrder: 0,
            isPrimary: true,
            width: 1200,
            height: 1200,
          },
        ],
        highlights: ["Breathable textured cotton", "Soft medium-weight drape", "Suitable for sofa, bed, or travel"],
        attributes: [
          { attributeKey: "material", displayName: "Material", value: "Cotton", sortOrder: 0, isFilterable: true },
          { attributeKey: "room", displayName: "Room", value: "Living room", sortOrder: 1, isFilterable: true },
          { attributeKey: "dimensions", displayName: "Dimensions", value: "130 x 170 cm", sortOrder: 2, isFilterable: false },
        ],
      },
    ],
  },
];

export function validateDemoCatalogSeedData() {
  validateBootstrapMasterSeedData();
  const categorySlugs = new Set<string>(bootstrapCategories.map((category) => category.slug));
  const brandSlugs = new Set<string>(bootstrapBrands.map((brand) => brand.slug));
  const shopSlugs = new Set<string>();
  const productKeys = new Set<string>();
  const skus = new Set<string>();

  for (const seller of demoCatalogSellers) {
    if (shopSlugs.has(seller.shop.slug)) throw new Error(`Duplicate demo shop slug ${seller.shop.slug}`);
    shopSlugs.add(seller.shop.slug);

    for (const product of seller.products) {
      if (!categorySlugs.has(product.categorySlug)) throw new Error(`Unknown demo category ${product.categorySlug}`);
      if (!brandSlugs.has(product.brandSlug)) throw new Error(`Unknown demo brand ${product.brandSlug}`);
      const productKey = `${seller.shop.slug}:${product.slug}`;
      if (productKeys.has(productKey)) throw new Error(`Duplicate demo product ${productKey}`);
      productKeys.add(productKey);
      if (product.highlights.length === 0) throw new Error(`Demo product ${product.slug} needs highlights`);
      if (product.images.length === 0) throw new Error(`Demo product ${product.slug} needs images`);
      if (product.attributes.length === 0) throw new Error(`Demo product ${product.slug} needs attributes`);

      const attributeKeys = new Set<string>();
      for (const attribute of product.attributes) {
        if (attribute.attributeKey !== attribute.attributeKey.toLowerCase()) {
          throw new Error(`Attribute key must be normalized: ${product.slug}:${attribute.attributeKey}`);
        }
        if (attributeKeys.has(attribute.attributeKey)) {
          throw new Error(`Duplicate attribute key ${product.slug}:${attribute.attributeKey}`);
        }
        attributeKeys.add(attribute.attributeKey);
      }

      for (const variant of product.variants) {
        if (skus.has(variant.sku)) throw new Error(`Duplicate demo variant SKU ${variant.sku}`);
        skus.add(variant.sku);
      }
    }
  }
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

export async function seedDemoCatalogData() {
  validateDemoCatalogSeedData();
  loadEnvLocal();
  await seedBootstrapMasterData();
  const { prisma } = await import("#server/lib/prisma.ts");

  const categoryBySlug = new Map((await prisma.category.findMany()).map((category) => [category.slug, category.id]));
  const brandBySlug = new Map((await prisma.brand.findMany()).map((brand) => [brand.slug, brand.id]));

  for (const seller of demoCatalogSellers) {
    await seedSellerCatalog(prisma, categoryBySlug, brandBySlug, seller);
  }
}

async function seedSellerCatalog(
  prisma: Prisma,
  categoryBySlug: Map<string, string>,
  brandBySlug: Map<string, string>,
  seller: DemoSeller,
) {
  const user = await prisma.user.upsert({
    where: { email: seller.email },
    update: {
      name: seller.name,
      role: "USER",
      status: "ACTIVE",
      emailVerified: true,
    },
    create: {
      email: seller.email,
      name: seller.name,
      role: "USER",
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  const sellerProfile = await prisma.sellerProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  const shop = await upsertByFindFirst(
    () => prisma.shop.findFirst({ where: { slug: seller.shop.slug } }),
    () =>
      prisma.shop.create({
        data: {
          ownerId: user.id,
          sellerProfileId: sellerProfile.id,
          name: seller.shop.name,
          slug: seller.shop.slug,
          status: "ACTIVE",
          contactEmail: seller.email,
          contactPhone: seller.shop.contactPhone,
        },
      }),
    (id) =>
      prisma.shop.update({
        where: { id },
        data: {
          ownerId: user.id,
          sellerProfileId: sellerProfile.id,
          name: seller.shop.name,
          status: "ACTIVE",
          contactEmail: seller.email,
          contactPhone: seller.shop.contactPhone,
        },
      }),
    (row) => row.id,
  );

  for (const productSeed of seller.products) {
    await seedProduct(prisma, categoryBySlug, brandBySlug, shop.id, productSeed);
  }
}

async function seedProduct(
  prisma: Prisma,
  categoryBySlug: Map<string, string>,
  brandBySlug: Map<string, string>,
  shopId: string,
  productSeed: DemoProduct,
) {
  const categoryId = categoryBySlug.get(productSeed.categorySlug);
  if (!categoryId) throw new Error(`Unknown category ${productSeed.categorySlug}`);
  const brandId = brandBySlug.get(productSeed.brandSlug);
  if (!brandId) throw new Error(`Unknown brand ${productSeed.brandSlug}`);

  const productData = {
    categoryId,
    brandId,
    title: productSeed.title,
    titleTh: productSeed.title,
    titleEn: productSeed.title,
    description: productSeed.description,
    descriptionTh: productSeed.description,
    descriptionEn: productSeed.description,
    metaTitle: productSeed.metaTitle,
    metaDescription: productSeed.metaDescription,
    warrantyInfo: productSeed.warrantyInfo,
    condition: productSeed.condition,
    countryOfOrigin: productSeed.countryOfOrigin,
    status: productSeed.status,
  };

  const product = await upsertByFindFirst(
    () => prisma.product.findFirst({ where: { shopId, slug: productSeed.slug } }),
    () =>
      prisma.product.create({
        data: {
          shopId,
          slug: productSeed.slug,
          ...productData,
        },
      }),
    (id) => prisma.product.update({ where: { id }, data: productData }),
    (row) => row.id,
  );

  for (const [index, highlight] of productSeed.highlights.entries()) {
    await upsertByFindFirst(
      () => prisma.productHighlight.findFirst({ where: { productId: product.id, sortOrder: index } }),
      () => prisma.productHighlight.create({ data: { productId: product.id, text: highlight, sortOrder: index } }),
      (id) => prisma.productHighlight.update({ where: { id }, data: { text: highlight, sortOrder: index } }),
      (row) => row.id,
    );
  }

  for (const imageSeed of productSeed.images) {
    await upsertByFindFirst(
      () => prisma.productImage.findFirst({ where: { productId: product.id, url: imageSeed.url } }),
      () => prisma.productImage.create({ data: { productId: product.id, ...imageSeed } }),
      (id) => prisma.productImage.update({ where: { id }, data: imageSeed }),
      (row) => row.id,
    );
  }

  for (const attributeSeed of productSeed.attributes) {
    await prisma.productAttribute.upsert({
      where: { productId_attributeKey: { productId: product.id, attributeKey: attributeSeed.attributeKey } },
      update: attributeSeed,
      create: { productId: product.id, ...attributeSeed },
    });
  }

  for (const variantSeed of productSeed.variants) {
    const variant = await prisma.productVariant.upsert({
      where: { productId_sku: { productId: product.id, sku: variantSeed.sku } },
      update: {
        title: variantSeed.title,
        titleTh: variantSeed.title,
        titleEn: variantSeed.title,
        price: BigInt(variantSeed.price),
        currency: "THB",
        status: "ACTIVE",
      },
      create: {
        productId: product.id,
        sku: variantSeed.sku,
        title: variantSeed.title,
        titleTh: variantSeed.title,
        titleEn: variantSeed.title,
        price: BigInt(variantSeed.price),
        currency: "THB",
        status: "ACTIVE",
      },
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

if (process.argv[1]?.endsWith("seed-demo-catalog.ts")) {
  seedDemoCatalogData()
    .then(() => {
      const productCount = demoCatalogSellers.reduce((total, seller) => total + seller.products.length, 0);
      console.log(`Seeded local demo catalog data: sellers=${demoCatalogSellers.length} products=${productCount}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      const { prisma } = await import("#server/lib/prisma.ts");
      await prisma.$disconnect();
    });
}
