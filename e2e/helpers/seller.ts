import { expect, type Page, type TestInfo } from "@playwright/test";

export type SellerIdentity = {
  email: string;
  password: string;
};

export const demoSeller: SellerIdentity = {
  email: process.env.E2E_SELLER_EMAIL ?? "seller-fashion@example.com",
  password: process.env.E2E_SELLER_PASSWORD ?? "DemoPass123!",
};

export async function isolateRateLimit(page: Page, testInfo: TestInfo) {
  const testKey = `${testInfo.project.name}-${testInfo.title}`.replace(/[^a-z0-9-]/gi, "-");
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `e2e-${testKey}` });
}

export async function waitForRenderedPage(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("body")).toBeVisible();
}

export async function signInSeller(page: Page, identity: SellerIdentity = demoSeller) {
  const existingSession = await page.request.get("/api/auth/get-session");
  if (existingSession.ok() && await existingSession.json()) return;

  const response = await page.request.post("/api/auth/sign-in/email", {
    data: identity,
  });
  const responseBody = await response.text();

  expect(response.ok(), `Seller sign-in failed: ${response.status()} ${responseBody}`).toBeTruthy();

  const sessionResponse = await page.request.get("/api/auth/get-session");
  expect(sessionResponse.ok(), "Authenticated session could not be read").toBeTruthy();
  expect(await sessionResponse.json(), "Seller sign-in did not create a session").toBeTruthy();
}

export async function assertHealthyPage(page: Page) {
  await expect(page.locator("body")).not.toContainText("[object Object]");
  await expect(page.locator("body")).not.toContainText("Application error");
  await expect(page.locator("body")).not.toContainText("Runtime TypeError");
  await expect(page.locator("main").first()).toBeVisible();
}

export async function openSellerRoute(page: Page, path = "", locale: "th" | "en" = "th") {
  await page.goto(`/${locale}/seller${path}`);
  await waitForRenderedPage(page);
  await assertHealthyPage(page);
}

export async function openProductStudio(page: Page) {
  const requestedProductId = process.env.E2E_PRODUCT_ID;
  if (requestedProductId) {
    await page.goto(`/th/seller/products/${requestedProductId}`);
  } else {
    await page.goto("/th/seller/products");
    await waitForRenderedPage(page);

    const editLink = page.locator('a[aria-label^="Edit "][href*="/seller/products/"]').first();
    await expect(editLink, "Seed at least one product owned by demo seller").toBeVisible();
    await editLink.click();
  }

  await waitForRenderedPage(page);
  await assertHealthyPage(page);
  await expect(page.locator("#seller-product-studio-form")).toBeVisible();
}

export async function getActiveShopId(page: Page) {
  await openSellerRoute(page);
  const productsHref = await page.locator('a[href*="/seller/products?shopId="]').first().getAttribute("href");
  expect(productsHref, "Seller shell should expose active shop id").toBeTruthy();
  return new URL(productsHref!, "http://localhost:3000").searchParams.get("shopId")!;
}
