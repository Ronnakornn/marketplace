import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import en from "../messages/en.json" with { type: "json" };
import { prisma } from "#server/lib/prisma.ts";
import { financeAdmin, primaryAdmin, signInAdmin } from "./helpers/admin";
import { signIn, storefrontFixture } from "./helpers/storefront";

const moderatedProductSlug = "e2e-admin-moderation-product";
let moderatedProductId = "";
let payoutId = "";

async function deleteFinanceFixtures() {
  const payouts = await prisma.sellerPayout.findMany({
    where: { amount: BigInt(777), requestedBy: { email: "seller-fashion@example.com" }, shop: { slug: "urban-thread-co" } },
    select: { id: true },
  });
  const payoutIds = payouts.map(({ id }) => id);
  if (payoutIds.length) {
    await prisma.walletLedgerEntry.deleteMany({ where: { payoutId: { in: payoutIds } } });
    await prisma.sellerTransaction.updateMany({ where: { payoutId: { in: payoutIds } }, data: { payoutId: null } });
    await prisma.sellerPayout.deleteMany({ where: { id: { in: payoutIds } } });
  }
  const admin = await prisma.user.findUnique({ where: { email: financeAdmin.email }, select: { id: true } });
  if (admin) await prisma.user.delete({ where: { id: admin.id } });
}

test.beforeAll(async () => {
  await deleteFinanceFixtures();

  const password = await hashPassword(financeAdmin.password);
  const secondAdmin = await prisma.user.upsert({
    where: { email: financeAdmin.email },
    update: { name: "Finance E2E Admin", role: "ADMIN", status: "ACTIVE", emailVerified: true },
    create: { name: "Finance E2E Admin", email: financeAdmin.email, role: "ADMIN", status: "ACTIVE", emailVerified: true },
  });
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: secondAdmin.id } },
    update: { userId: secondAdmin.id, password, issuer: "local:credential" },
    create: { providerId: "credential", accountId: secondAdmin.id, userId: secondAdmin.id, password, issuer: "local:credential" },
  });

  const shop = await prisma.shop.findFirst({ where: { slug: "urban-thread-co" }, include: { wallet: true } });
  const seller = await prisma.user.findUnique({ where: { email: "seller-fashion@example.com" } });
  expect(shop?.wallet, "Seeded shop wallet is required").toBeTruthy();
  expect(seller, "Seeded seller is required").toBeTruthy();
  const category = await prisma.category.findFirst({ where: { isActive: true } });
  expect(category, "Admin moderation E2E requires an active category").toBeTruthy();

  await prisma.product.deleteMany({ where: { slug: moderatedProductSlug } });
  const product = await prisma.product.create({
    data: { shopId: shop!.id, sellerProfileId: shop!.sellerProfileId, categoryId: category!.id, title: "Admin Moderation E2E Product", slug: moderatedProductSlug, status: "ACTIVE" },
  });
  moderatedProductId = product.id;

  const payout = await prisma.sellerPayout.create({
    data: {
      walletId: shop!.wallet!.id,
      shopId: shop!.id,
      amount: BigInt(777),
      currency: "THB",
      requestedById: seller!.id,
    },
  });
  payoutId = payout.id;
});

test.afterAll(async () => {
  await deleteFinanceFixtures();
  if (moderatedProductId) await prisma.product.deleteMany({ where: { id: moderatedProductId } });
  await prisma.$disconnect();
});

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
});

test("admin pages reject unauthenticated and non-admin users", async ({ page }) => {
  await page.goto("/en/admin");
  await expect(page).toHaveURL(/\/en\/login\?next=/);

  await signIn(page, storefrontFixture.buyer);
  const response = await page.goto("/en/admin");
  expect(response?.status()).toBe(404);
});

test("admin navigation keeps the locale and core backoffice pages render", async ({ page }) => {
  await signInAdmin(page);
  await page.goto("/en/admin");
  await expect(page.locator('a[href="/en/admin"]').first()).toBeVisible();

  for (const path of ["users", "shops", "products", "orders", "refunds", "returns", "payouts", "reports"] as const) {
    await test.step(path, async () => {
      await page.goto(`/en/admin/${path}`);
      await expect(page).toHaveURL(new RegExp(`/en/admin/${path}$`));
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expect(page.locator("main").first()).toBeVisible();
    });
  }
});

test("admin suspends and restores a published product through the moderation UI", async ({ page }) => {
  await signInAdmin(page);
  await page.goto("/en/admin/products");

  const search = page.getByPlaceholder(en.admin.search.products);
  await search.fill(moderatedProductSlug);
  const row = page.getByRole("row").filter({ hasText: moderatedProductSlug });
  await expect(row).toBeVisible();
  await expect(row.getByRole("link", { name: en.admin.ui.detail })).toHaveAttribute(
    "href",
    `/en/admin/products/${moderatedProductId}`,
  );

  await row.getByRole("button", { name: en.admin.ui.suspend }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel(en.admin.ui.reason).fill("E2E verified policy violation");
  await dialog.getByRole("button", { name: en.admin.ui.suspend }).click();
  await expect(page.getByText(/suspended/i).first()).toBeVisible();

  await row.getByRole("button", { name: en.admin.productModerationDetail.restore }).click();
  await expect(page.getByText(/restored/i).first()).toBeVisible();
});

test("finance operations require a second admin to mark an approved payout paid", async ({ page }) => {
  await signInAdmin(page, primaryAdmin);

  const approve = await page.request.patch(`/api/admin/payouts/${payoutId}/approve`);
  expect(approve.ok(), await approve.text()).toBeTruthy();

  const sameAdmin = await page.request.patch(`/api/admin/payouts/${payoutId}/mark-paid`, {
    data: { externalReference: "E2E-SAME-ADMIN" },
  });
  expect(sameAdmin.status()).toBe(409);

  await signInAdmin(page, financeAdmin);
  const paid = await page.request.patch(`/api/admin/payouts/${payoutId}/mark-paid`, {
    data: { externalReference: "E2E-TWO-PERSON-PAID" },
  });
  expect(paid.ok(), await paid.text()).toBeTruthy();

  const detail = await page.request.get(`/api/admin/payouts/${payoutId}`);
  expect(detail.ok(), await detail.text()).toBeTruthy();
  await expect(detail.json()).resolves.toMatchObject({ status: "paid", externalReference: "E2E-TWO-PERSON-PAID" });
});
