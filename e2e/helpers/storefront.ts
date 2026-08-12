import { expect, type Page } from "@playwright/test";
import { prisma } from "#server/lib/prisma.ts";

export const storefrontFixture = {
  slug: "urban-thread-co",
  inactiveSlug: "e2e-inactive-storefront",
  buyer: { email: "buyer.demo@example.com", password: "DemoPass123!" },
  owner: { email: "seller-fashion@example.com", password: "DemoPass123!" },
};

export async function prepareStorefrontFixtures() {
  const shop = await prisma.shop.findFirst({ where: { slug: storefrontFixture.slug }, include: { sellerProfile: true } });
  expect(shop, "Run `bun run db:seed` before storefront E2E").toBeTruthy();
  const category = await prisma.category.findFirst({ where: { isActive: true } });
  expect(category, "Storefront E2E requires a seeded category").toBeTruthy();

  await prisma.shop.update({
    where: { id: shop!.id },
    data: {
      status: "ACTIVE",
      description: "Storefront fallback description",
      descriptionTh: "ร้านทดสอบสำหรับผู้ซื้อ",
      descriptionEn: "Deterministic buyer storefront",
      logoUrl: "/images/fallback-shop.svg",
      coverUrl: "/images/fallback-product.svg",
      settings: {
        upsert: {
          create: { chatEnabled: true, shippingPolicyTh: "จัดส่งภายในสองวัน", shippingPolicyEn: "Ships within two days", returnPolicy: "Returns within seven days" },
          update: { chatEnabled: true, shippingPolicyTh: "จัดส่งภายในสองวัน", shippingPolicyEn: "Ships within two days", returnPolicy: "Returns within seven days" },
        },
      },
    },
  });

  const inactive = await prisma.shop.findFirst({ where: { slug: storefrontFixture.inactiveSlug }, select: { id: true } });
  await prisma.shop.upsert({
    where: { id: inactive?.id ?? "00000000-0000-0000-0000-000000000000" },
    create: { ownerId: shop!.ownerId, sellerProfileId: shop!.sellerProfileId, name: "Inactive E2E Shop", slug: storefrontFixture.inactiveSlug, status: "SUSPENDED", contactEmail: "private-inactive@example.com", contactPhone: "+66000000000" },
    update: { status: "SUSPENDED" },
  });

  for (let index = 1; index <= 13; index += 1) {
    const slug = `e2e-storefront-product-${String(index).padStart(2, "0")}`;
    const product = await prisma.product.upsert({
      where: { id: (await prisma.product.findFirst({ where: { shopId: shop!.id, slug }, select: { id: true } }))?.id ?? "00000000-0000-0000-0000-000000000000" },
      create: { shopId: shop!.id, sellerProfileId: shop!.sellerProfileId, categoryId: category!.id, title: `E2E Storefront Product ${index}`, titleEn: `E2E Storefront Product ${index}`, titleTh: `สินค้าทดสอบ ${index}`, slug, status: "ACTIVE" },
      update: { status: "ACTIVE", categoryId: category!.id },
    });
    const variant = await prisma.productVariant.upsert({
      where: { productId_sku: { productId: product.id, sku: `E2E-SF-${index}` } },
      create: { productId: product.id, sku: `E2E-SF-${index}`, title: "Default", price: BigInt(1000 + index), status: "ACTIVE" },
      update: { price: BigInt(1000 + index), status: "ACTIVE" },
    });
    await prisma.inventory.upsert({ where: { variantId: variant.id }, create: { variantId: variant.id, quantityOnHand: index === 13 ? 0 : 10 }, update: { quantityOnHand: index === 13 ? 0 : 10, quantityReserved: 0 } });
  }
  return { shopId: shop!.id, categorySlug: category!.slug };
}

export async function closeStorefrontFixtures() {
  await prisma.$disconnect();
}

export async function signIn(page: Page, identity: { email: string; password: string }) {
  const response = await page.request.post("/api/auth/sign-in/email", { data: identity });
  expect(response.ok(), await response.text()).toBeTruthy();
  const session = await page.request.get("/api/auth/get-session");
  expect(session.ok(), "Authenticated storefront session could not be read").toBeTruthy();
  expect(await session.json(), "Storefront sign-in did not create a session").toBeTruthy();
}

export async function openStorefront(page: Page, locale: "th" | "en" = "en", slug = storefrontFixture.slug) {
  await page.goto(`/${locale}/shops/${slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
