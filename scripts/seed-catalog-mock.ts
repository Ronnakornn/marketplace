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
  priceCents: number;
  quantityOnHand: number;
  reorderLevel: number;
}

interface MockProduct {
  title: string;
  slug: string;
  description: string;
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
        title: "Everyday Oversized Cotton Tee",
        slug: "everyday-oversized-cotton-tee",
        description: "Heavyweight cotton tee with relaxed streetwear fit, made for daily marketplace browsing demos.",
        status: "ACTIVE",
        variants: [
          { sku: "UTC-TEE-BLK-S", title: "Black / S", priceCents: 790, quantityOnHand: 32, reorderLevel: 8 },
          { sku: "UTC-TEE-BLK-M", title: "Black / M", priceCents: 790, quantityOnHand: 46, reorderLevel: 8 },
          { sku: "UTC-TEE-BLK-L", title: "Black / L", priceCents: 850, quantityOnHand: 28, reorderLevel: 8 },
          { sku: "UTC-TEE-WHT-S", title: "White / S", priceCents: 750, quantityOnHand: 24, reorderLevel: 8 },
          { sku: "UTC-TEE-WHT-M", title: "White / M", priceCents: 750, quantityOnHand: 41, reorderLevel: 8 },
          { sku: "UTC-TEE-SGE-M", title: "Sage / M", priceCents: 890, quantityOnHand: 16, reorderLevel: 6 },
          { sku: "UTC-TEE-SGE-L", title: "Sage / L", priceCents: 890, quantityOnHand: 11, reorderLevel: 6 },
        ],
      },
      {
        title: "Relaxed Linen Resort Shirt",
        slug: "relaxed-linen-resort-shirt",
        description: "Breathable linen blend shirt with color and size price differences for variant testing.",
        status: "ACTIVE",
        variants: [
          { sku: "UTC-LIN-IVR-M", title: "Ivory / M", priceCents: 1290, quantityOnHand: 18, reorderLevel: 5 },
          { sku: "UTC-LIN-IVR-L", title: "Ivory / L", priceCents: 1290, quantityOnHand: 21, reorderLevel: 5 },
          { sku: "UTC-LIN-NVY-M", title: "Navy / M", priceCents: 1390, quantityOnHand: 13, reorderLevel: 5 },
          { sku: "UTC-LIN-NVY-L", title: "Navy / L", priceCents: 1390, quantityOnHand: 9, reorderLevel: 5 },
          { sku: "UTC-LIN-CLY-XL", title: "Clay / XL", priceCents: 1490, quantityOnHand: 6, reorderLevel: 4 },
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
        title: "High-Rise Active Leggings",
        slug: "high-rise-active-leggings",
        description: "Compression leggings with multiple colors and sizes for price/stock UI states.",
        status: "ACTIVE",
        variants: [
          { sku: "FLA-LEG-BLK-XS", title: "Black / XS", priceCents: 1590, quantityOnHand: 14, reorderLevel: 5 },
          { sku: "FLA-LEG-BLK-S", title: "Black / S", priceCents: 1590, quantityOnHand: 25, reorderLevel: 5 },
          { sku: "FLA-LEG-BLK-M", title: "Black / M", priceCents: 1690, quantityOnHand: 30, reorderLevel: 5 },
          { sku: "FLA-LEG-COC-S", title: "Cocoa / S", priceCents: 1790, quantityOnHand: 12, reorderLevel: 4 },
          { sku: "FLA-LEG-COC-M", title: "Cocoa / M", priceCents: 1790, quantityOnHand: 7, reorderLevel: 4 },
          { sku: "FLA-LEG-ICE-L", title: "Ice Blue / L", priceCents: 1890, quantityOnHand: 3, reorderLevel: 4 },
        ],
      },
      {
        title: "Wide-Leg Washed Denim Jeans",
        slug: "wide-leg-washed-denim-jeans",
        description: "Soft washed denim with size and wash variants for catalog management testing.",
        status: "DRAFT",
        variants: [
          { sku: "FLA-DNM-LGT-28", title: "Light Wash / 28", priceCents: 1890, quantityOnHand: 10, reorderLevel: 4 },
          { sku: "FLA-DNM-LGT-30", title: "Light Wash / 30", priceCents: 1890, quantityOnHand: 15, reorderLevel: 4 },
          { sku: "FLA-DNM-LGT-32", title: "Light Wash / 32", priceCents: 1990, quantityOnHand: 8, reorderLevel: 4 },
          { sku: "FLA-DNM-DRK-30", title: "Dark Wash / 30", priceCents: 2090, quantityOnHand: 11, reorderLevel: 4 },
          { sku: "FLA-DNM-DRK-32", title: "Dark Wash / 32", priceCents: 2190, quantityOnHand: 5, reorderLevel: 3 },
        ],
      },
    ] satisfies MockProduct[],
  },
];

async function main() {
  loadEnvLocal();
  const { prisma } = await import("#server/lib/prisma.ts");

  for (const seller of sellers) {
    const [user] = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "User" ("id", "name", "email", "emailVerified", "role", "status", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${seller.name}, ${seller.email}, true, 'SELLER'::"Role", 'ACTIVE'::"UserStatus", now(), now())
      ON CONFLICT ("email") DO UPDATE
      SET "name" = EXCLUDED."name",
          "role" = 'SELLER'::"Role",
          "status" = 'ACTIVE'::"UserStatus",
          "updatedAt" = now()
      RETURNING "id"
    `;

    if (!user) throw new Error(`Failed to upsert seller user ${seller.email}`);

    const [shop] = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "Shop" ("id", "ownerId", "name", "slug", "status", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${user.id}::uuid, ${seller.shop.name}, ${seller.shop.slug}, 'ACTIVE'::"ShopStatus", now(), now())
      ON CONFLICT ("slug") DO UPDATE
      SET "ownerId" = ${user.id}::uuid,
          "name" = EXCLUDED."name",
          "status" = 'ACTIVE'::"ShopStatus",
          "updatedAt" = now()
      RETURNING "id"
    `;

    if (!shop) throw new Error(`Failed to upsert shop ${seller.shop.slug}`);

    for (const productSeed of seller.products) {
      const product = await prisma.product.upsert({
        where: {
          shopId_slug: {
            shopId: shop.id,
            slug: productSeed.slug,
          },
        },
        update: {
          title: productSeed.title,
          description: productSeed.description,
          status: productSeed.status,
        },
        create: {
          shopId: shop.id,
          title: productSeed.title,
          slug: productSeed.slug,
          description: productSeed.description,
          status: productSeed.status,
        },
      });

      for (const variantSeed of productSeed.variants) {
        const variant = await prisma.productVariant.upsert({
          where: { sku: variantSeed.sku },
          update: {
            productId: product.id,
            title: variantSeed.title,
            priceCents: variantSeed.priceCents,
            currency: "USD",
          },
          create: {
            productId: product.id,
            sku: variantSeed.sku,
            title: variantSeed.title,
            priceCents: variantSeed.priceCents,
            currency: "USD",
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
