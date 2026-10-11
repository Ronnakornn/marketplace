import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "#server/lib/prisma.ts";
import en from "../messages/en.json" with { type: "json" };
import th from "../messages/th.json" with { type: "json" };
import { newActorContext } from "./helpers/browser-context";
import { loginUi } from "./helpers/commerce-fixtures";

declare global {
  interface Window { __productionCacheMarker?: string }
}

test.setTimeout(120_000);
test.beforeAll(() => {
  const database = new URL(process.env.DATABASE_URL ?? "http://missing");
  if (!["localhost", "127.0.0.1"].includes(database.hostname) || !database.pathname.startsWith("/marketplace_e2e_")) {
    throw new Error("Account cache isolation requires a disposable local marketplace_e2e_* database");
  }
});
test.afterAll(async () => { await prisma.$disconnect(); });

test("switching accounts in the same document isolates cached profile, address and orders", async ({ browser, baseURL }) => {
  const runId = randomUUID();
  const password = "AccountCache123!";
  const passwordHash = await hashPassword(password);
  async function createBuyer(label: string) {
    const user = await prisma.user.create({ data: { name: `${label} ${runId}`, email: `${label.toLowerCase()}-${runId}@example.test`, emailVerified: true, role: "USER", status: "ACTIVE" } });
    await prisma.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: passwordHash, issuer: "local:credential" } });
    await prisma.address.create({ data: { userId: user.id, recipientName: user.name, phone: "+66800000001", line1: `${label} private address ${runId}`, city: "Bangkok", postalCode: "10110", country: "TH", isDefault: true } });
    return { ...user, password };
  }
  const buyerA = await createBuyer("BuyerA");
  const buyerB = await createBuyer("BuyerB");
  const cart = await prisma.cart.create({ data: { userId: buyerA.id, status: "CHECKED_OUT" } });
  const checkout = await prisma.checkout.create({ data: { userId: buyerA.id, cartId: cart.id, status: "PAYMENT_PENDING", expiresAt: new Date(Date.now() + 900_000), subtotal: 100n, grandTotal: 100n } });
  const orderNumber = `CACHE-${runId}`;
  await prisma.order.create({ data: { userId: buyerA.id, checkoutId: checkout.id, orderNumber, status: "PENDING_PAYMENT", paymentStatus: "PENDING", subtotal: 100n, grandTotal: 100n, shippingName: buyerA.name, shippingLine1: "Private order address", shippingCity: "Bangkok", shippingPostalCode: "10110", shippingCountry: "TH" } });

  const context = await newActorContext(browser, { baseURL });
  const page = await context.newPage();
  try {
    await loginUi(page, buyerA, "/en/profile");
    await expect(page.getByRole("heading", { name: buyerA.name, exact: true })).toBeVisible();
    await expect(page.getByText(`BuyerA private address ${runId}`, { exact: false })).toBeVisible();
    await page.getByRole("link", { name: en.buyer.myOrders, exact: true }).click();
    await expect(page.getByRole("heading", { name: orderNumber, exact: true })).toBeVisible();
    const marker = randomUUID();
    await page.evaluate((value) => { window.__productionCacheMarker = value; }, marker);
    await page.getByRole("button", { name: en.common.logout, exact: true }).click();
    await expect(page).toHaveURL("/en");
    await page.getByRole("link", { name: en.common.login, exact: true }).first().click();
    await page.getByLabel(en.auth.email, { exact: true }).fill(buyerB.email);
    await page.getByLabel(en.auth.password, { exact: true }).fill(password);
    await page.getByRole("button", { name: en.auth.signIn, exact: true }).click();
    await expect(page).toHaveURL(/\/(?:en|th)$/);
    const messages = new URL(page.url()).pathname === "/th" ? th : en;
    await page.getByRole("link", { name: messages.common.profile, exact: true }).first().click();
    await expect(page.getByRole("heading", { name: buyerB.name, exact: true })).toBeVisible();
    await expect(page.getByText(`BuyerB private address ${runId}`, { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: buyerA.name, exact: true })).toHaveCount(0);
    await expect(page.getByText(`BuyerA private address ${runId}`, { exact: false })).toHaveCount(0);
    await page.getByRole("link", { name: messages.buyer.myOrders, exact: true }).click();
    await expect(page.getByText(messages.order.noOrdersTitle, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: orderNumber, exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__productionCacheMarker)).toBe(marker);
  } finally {
    await context.close();
  }
});
