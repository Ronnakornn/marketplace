import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

interface MockVariant {
  sku: string;
  title: string;
  titleTh?: string;
  titleEn?: string;
  price: number;
  quantityOnHand: number;
  reorderLevel: number;
}

interface MockProduct {
  categorySlug: string;
  title: string;
  titleTh?: string;
  titleEn?: string;
  slug: string;
  description: string;
  descriptionTh?: string;
  descriptionEn?: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  variants: MockVariant[];
}

const sellers = [
  {
    email: "seller-fashion-a@example.com",
    name: "Seller Fashion A",
    shop: {
      name: "Urban Thread Co.",
      slug: "urban-thread-co",
    },
    products: [
      {
        categorySlug: "fashion",
        title: "Everyday Oversized Cotton Tee",
        slug: "everyday-oversized-cotton-tee",
        description: "Heavyweight cotton tee with relaxed streetwear fit, made for daily marketplace browsing demos.",
        status: "ACTIVE",
        variants: [
          { sku: "UTC-TEE-BLK-S", title: "Black / S", price: 790, quantityOnHand: 32, reorderLevel: 8 },
          { sku: "UTC-TEE-BLK-M", title: "Black / M", price: 790, quantityOnHand: 46, reorderLevel: 8 },
          { sku: "UTC-TEE-BLK-L", title: "Black / L", price: 850, quantityOnHand: 28, reorderLevel: 8 },
          { sku: "UTC-TEE-WHT-S", title: "White / S", price: 750, quantityOnHand: 24, reorderLevel: 8 },
          { sku: "UTC-TEE-WHT-M", title: "White / M", price: 750, quantityOnHand: 41, reorderLevel: 8 },
          { sku: "UTC-TEE-SGE-M", title: "Sage / M", price: 890, quantityOnHand: 16, reorderLevel: 6 },
          { sku: "UTC-TEE-SGE-L", title: "Sage / L", price: 890, quantityOnHand: 11, reorderLevel: 6 },
        ],
      },
      {
        categorySlug: "fashion",
        title: "Relaxed Linen Resort Shirt",
        slug: "relaxed-linen-resort-shirt",
        description: "Breathable linen blend shirt with color and size price differences for variant testing.",
        status: "ACTIVE",
        variants: [
          { sku: "UTC-LIN-IVR-M", title: "Ivory / M", price: 1290, quantityOnHand: 18, reorderLevel: 5 },
          { sku: "UTC-LIN-IVR-L", title: "Ivory / L", price: 1290, quantityOnHand: 21, reorderLevel: 5 },
          { sku: "UTC-LIN-NVY-M", title: "Navy / M", price: 1390, quantityOnHand: 13, reorderLevel: 5 },
          { sku: "UTC-LIN-NVY-L", title: "Navy / L", price: 1390, quantityOnHand: 9, reorderLevel: 5 },
          { sku: "UTC-LIN-CLY-XL", title: "Clay / XL", price: 1490, quantityOnHand: 6, reorderLevel: 4 },
        ],
      },
    ] satisfies MockProduct[],
  },
  {
    email: "seller-fashion-b@example.com",
    name: "Seller Fashion B",
    shop: {
      name: "FitLab Apparel",
      slug: "fitlab-apparel",
    },
    products: [
      {
        categorySlug: "sports",
        title: "High-Rise Active Leggings",
        slug: "high-rise-active-leggings",
        description: "Compression leggings with multiple colors and sizes for price/stock UI states.",
        status: "ACTIVE",
        variants: [
          { sku: "FLA-LEG-BLK-XS", title: "Black / XS", price: 1590, quantityOnHand: 14, reorderLevel: 5 },
          { sku: "FLA-LEG-BLK-S", title: "Black / S", price: 1590, quantityOnHand: 25, reorderLevel: 5 },
          { sku: "FLA-LEG-BLK-M", title: "Black / M", price: 1690, quantityOnHand: 30, reorderLevel: 5 },
          { sku: "FLA-LEG-COC-S", title: "Cocoa / S", price: 1790, quantityOnHand: 12, reorderLevel: 4 },
          { sku: "FLA-LEG-COC-M", title: "Cocoa / M", price: 1790, quantityOnHand: 7, reorderLevel: 4 },
          { sku: "FLA-LEG-ICE-L", title: "Ice Blue / L", price: 1890, quantityOnHand: 3, reorderLevel: 4 },
        ],
      },
      {
        categorySlug: "fashion",
        title: "Wide-Leg Washed Denim Jeans",
        slug: "wide-leg-washed-denim-jeans",
        description: "Soft washed denim with size and wash variants for catalog management testing.",
        status: "DRAFT",
        variants: [
          { sku: "FLA-DNM-LGT-28", title: "Light Wash / 28", price: 1890, quantityOnHand: 10, reorderLevel: 4 },
          { sku: "FLA-DNM-LGT-30", title: "Light Wash / 30", price: 1890, quantityOnHand: 15, reorderLevel: 4 },
          { sku: "FLA-DNM-LGT-32", title: "Light Wash / 32", price: 1990, quantityOnHand: 8, reorderLevel: 4 },
          { sku: "FLA-DNM-DRK-30", title: "Dark Wash / 30", price: 2090, quantityOnHand: 11, reorderLevel: 4 },
          { sku: "FLA-DNM-DRK-32", title: "Dark Wash / 32", price: 2190, quantityOnHand: 5, reorderLevel: 3 },
        ],
      },
    ] satisfies MockProduct[],
  },
];

const categories = [
  { name: "Fashion", nameTh: "แฟชั่น", nameEn: "Fashion", slug: "fashion", sortOrder: 10 },
  { name: "Beauty", nameTh: "ความงาม", nameEn: "Beauty", slug: "beauty", sortOrder: 20 },
  { name: "Gadgets", nameTh: "แกดเจ็ต", nameEn: "Gadgets", slug: "gadgets", sortOrder: 30 },
  { name: "Electronics", nameTh: "อิเล็กทรอนิกส์", nameEn: "Electronics", slug: "electronics", sortOrder: 35 },
  { name: "Home", nameTh: "บ้าน", nameEn: "Home", slug: "home", sortOrder: 40 },
  { name: "Sports", nameTh: "กีฬา", nameEn: "Sports", slug: "sports", sortOrder: 50 },
  { name: "Kids", nameTh: "เด็ก", nameEn: "Kids", slug: "kids", sortOrder: 60 },
  { name: "Groceries", nameTh: "ของใช้ประจำวัน", nameEn: "Groceries", slug: "groceries", sortOrder: 70 },
  { name: "Pets", nameTh: "สัตว์เลี้ยง", nameEn: "Pets", slug: "pets", sortOrder: 80 },
  { name: "Deals", nameTh: "ดีล", nameEn: "Deals", slug: "deals", sortOrder: 90 },
];

async function main() {
  loadEnvLocal();
  const { prisma } = await import("#server/lib/prisma.ts");

  const categoryBySlug = new Map<string, string>();
  for (const categorySeed of categories) {
    const category = await prisma.category.upsert({
      where: { slug: categorySeed.slug },
      update: {
        name: categorySeed.name,
        nameTh: categorySeed.nameTh,
        nameEn: categorySeed.nameEn,
        sortOrder: categorySeed.sortOrder,
        isActive: true,
      },
      create: {
        name: categorySeed.name,
        nameTh: categorySeed.nameTh,
        nameEn: categorySeed.nameEn,
        slug: categorySeed.slug,
        sortOrder: categorySeed.sortOrder,
        isActive: true,
      },
    });
    categoryBySlug.set(category.slug, category.id);
  }

  const sellerPhoneByEmail: Record<string, string> = {
    "seller-fashion-a@example.com": "+66812345681",
    "seller-fashion-b@example.com": "+66812345682",
  };

  for (const seller of sellers) {
    const user = await prisma.user.upsert({
      where: { email: seller.email },
      update: {
        name: seller.name,
        role: "USER",
        status: "ACTIVE",
        emailVerified: true,
        updatedAt: new Date(),
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

    const existingShop = await prisma.shop.findFirst({ where: { slug: seller.shop.slug } });
    const shop = existingShop
      ? await prisma.shop.update({
          where: { id: existingShop.id },
          data: {
            ownerId: user.id,
            sellerProfileId: sellerProfile.id,
            name: seller.shop.name,
            status: "ACTIVE",
            contactEmail: seller.email,
            contactPhone: sellerPhoneByEmail[seller.email] ?? "+66812345699",
            updatedAt: new Date(),
          },
        })
      : await prisma.shop.create({
          data: {
            ownerId: user.id,
            sellerProfileId: sellerProfile.id,
            name: seller.shop.name,
            slug: seller.shop.slug,
            status: "ACTIVE",
            contactEmail: seller.email,
            contactPhone: sellerPhoneByEmail[seller.email] ?? "+66812345699",
          },
        });

    if (!shop) throw new Error(`Failed to create or update shop ${seller.shop.slug}`);

    for (const productSeed of seller.products as MockProduct[]) {
      const categoryId = categoryBySlug.get(productSeed.categorySlug);
      if (!categoryId) throw new Error(`Unknown category ${productSeed.categorySlug}`);

      const existingProduct = await prisma.product.findFirst({ where: { shopId: shop.id, slug: productSeed.slug } });
      const product = existingProduct
        ? await prisma.product.update({
            where: { id: existingProduct.id },
            data: {
              categoryId,
              title: productSeed.title,
              titleTh: productSeed.titleTh ?? productSeed.title,
              titleEn: productSeed.titleEn ?? productSeed.title,
              description: productSeed.description,
              descriptionTh: productSeed.descriptionTh ?? productSeed.description,
              descriptionEn: productSeed.descriptionEn ?? productSeed.description,
              status: productSeed.status,
            },
          })
        : await prisma.product.create({
            data: {
              shopId: shop.id,
              categoryId,
              title: productSeed.title,
              titleTh: productSeed.titleTh ?? productSeed.title,
              titleEn: productSeed.titleEn ?? productSeed.title,
              slug: productSeed.slug,
              description: productSeed.description,
              descriptionTh: productSeed.descriptionTh ?? productSeed.description,
              descriptionEn: productSeed.descriptionEn ?? productSeed.description,
              status: productSeed.status,
            },
          });

      for (const variantSeed of productSeed.variants as MockVariant[]) {
        const variant = await prisma.productVariant.upsert({
          where: { productId_sku: { productId: product.id, sku: variantSeed.sku } },
          update: {
            title: variantSeed.title,
            titleTh: variantSeed.titleTh ?? variantSeed.title,
            titleEn: variantSeed.titleEn ?? variantSeed.title,
            price: BigInt(variantSeed.price),
            currency: "THB",
          },
          create: {
            productId: product.id,
            sku: variantSeed.sku,
            title: variantSeed.title,
            titleTh: variantSeed.titleTh ?? variantSeed.title,
            titleEn: variantSeed.titleEn ?? variantSeed.title,
            price: BigInt(variantSeed.price),
            currency: "THB",
          },
        });

        await prisma.inventory.upsert({
          where: { variantId: variant.id },
          update: {
            quantityOnHand: variantSeed.quantityOnHand,
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

  console.log("Seeded clothing catalog mock data with size/color variants.");
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
