import { expect, test } from "@playwright/test";
import { openStorefront, prepareStorefrontFixtures, signIn, storefrontFixture } from "./helpers/storefront";

let shopId = "";
let categorySlug = "";

test.beforeAll(async () => {
  ({ shopId, categorySlug } = await prepareStorefrontFixtures());
});

test("public UUID and slug APIs resolve active shops without private fields", async ({ request }) => {
  for (const identifier of [shopId, storefrontFixture.slug]) {
    const response = await request.get(`/api/shops/${identifier}/storefront?locale=en`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toMatchObject({ id: shopId, slug: storefrontFixture.slug, viewer: { isOwner: false } });
    for (const privateKey of ["ownerId", "contactEmail", "contactPhone", "settings", "sellerProfileId"]) expect(body).not.toHaveProperty(privateKey);
  }
  expect((await request.get(`/api/shops/${storefrontFixture.inactiveSlug}/storefront?locale=en`)).status()).toBe(404);
});

test("English desktop and Thai mobile share storefront chrome, media, and localized policies", async ({ page }) => {
  await openStorefront(page, "en");
  await expect(page.getByText("Deterministic buyer storefront")).toBeVisible();
  await expect(page.getByText("Shipping policy")).toBeVisible();
  await page.getByText("Shipping policy").click();
  await expect(page.getByText("Ships within two days")).toBeVisible();
  await expect(page.locator("nav.fixed.bottom-0")).toBeAttached();
  await page.screenshot({ path: "test-results/milestone-28/storefront-en-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await openStorefront(page, "th");
  await expect(page.getByText("ร้านทดสอบสำหรับผู้ซื้อ")).toBeVisible();
  await expect(page.getByText("นโยบายการจัดส่ง")).toBeVisible();
  await page.screenshot({ path: "test-results/milestone-28/storefront-th-mobile.png", fullPage: true });
});

test("catalog preserves URL filters, loads beyond twelve, deduplicates, and retains out-of-stock products", async ({ page }) => {
  await page.goto(`/en/shops/${storefrontFixture.slug}?q=E2E&category=${categorySlug}&sort=price_desc`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/q=E2E.*category=.*sort=price_desc/);
  const cards = page.locator('main article:has(a[href^="/products/"])');
  await expect(cards).toHaveCount(12);
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(cards).toHaveCount(13);
  const hrefs = await cards.locator('a[href^="/products/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(new Set(hrefs).size).toBe(13);
  await expect(page.getByText("Out of stock").first()).toBeVisible();
  await expect(page.getByText("You have reached the end of this shop's products.")).toBeVisible();
});

test("review summary is bounded, history expands, policies are plain text, and tracking failure stays non-blocking", async ({ page }) => {
  await page.route("**/api/discovery/track", (route) => route.abort("failed"));
  await page.route("**/api/shops/*/reviews/feed*", (route) => route.fulfill({ json: {
    items: Array.from({ length: 4 }, (_, index) => ({ id: `review-${index}`, userName: `Buyer ${index}`, rating: 5, comment: `Published ${index}`, createdAt: "2026-08-08T00:00:00.000Z" })),
    meta: { page: 1, pageSize: 10, totalCount: 4, hasNextPage: false },
  } }));
  await openStorefront(page, "en");
  await expect(page.locator("#reviews article")).toHaveCount(3);
  await page.getByRole("button", { name: "View all reviews" }).click();
  await expect(page.locator("#reviews article")).toHaveCount(4);
  await page.getByText("Return policy").click();
  await expect(page.getByText("Returns within seven days")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shop products" })).toBeVisible();
});

test("anonymous login return, buyer follow/chat, and owner management actions are correct", async ({ browser, page }) => {
  await openStorefront(page, "en");
  await page.getByRole("button", { name: "Follow shop" }).click();
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fshops%2Furban-thread-co/);

  const buyerContext = await browser.newContext({ baseURL: "http://localhost:3000" });
  const buyer = await buyerContext.newPage();
  await signIn(buyer, storefrontFixture.buyer);
  await buyer.route("**/api/discovery/track", (route) => route.abort("failed"));
  await buyer.route(`**/api/shops/${shopId}/follow`, async (route) => route.fulfill({ json: route.request().method() === "GET" ? { following: false } : { following: true } }));
  await buyer.route("**/api/chats", (route) => route.fulfill({ json: { roomId: "e2e-room", shopId, shopName: "Urban Thread Co.", buyerName: "Demo Buyer", messages: [] } }));
  await openStorefront(buyer, "en");
  await buyer.getByRole("button", { name: "Follow shop" }).click();
  await expect(buyer.getByRole("heading", { name: "Shop products" })).toBeVisible();
  await buyer.getByRole("button", { name: "Chat with shop" }).click();
  await expect(buyer).toHaveURL(/\/en\/chat\/e2e-room/);
  await buyerContext.close();

  const ownerContext = await browser.newContext({ baseURL: "http://localhost:3000" });
  const owner = await ownerContext.newPage();
  await signIn(owner, storefrontFixture.owner);
  await openStorefront(owner, "en");
  await expect(owner.getByRole("link", { name: "Manage shop" })).toBeVisible();
  await expect(owner.getByRole("button", { name: "Follow shop" })).toHaveCount(0);
  await expect(owner.getByRole("button", { name: "Chat with shop" })).toHaveCount(0);
  await owner.screenshot({ path: "test-results/milestone-28/storefront-owner.png", fullPage: true });
  await ownerContext.close();
});

test("shared homepage and non-shop chrome remain available", async ({ page }) => {
  await page.goto("/en", { waitUntil: "domcontentloaded" });
  await expect(page.locator("header").first()).toBeVisible();
  await expect(page.locator("nav.fixed.bottom-0")).toBeAttached();
  await expect(page.locator('a[href*="/shops/"]').first()).toBeAttached();
  await page.goto("/en/about", { waitUntil: "domcontentloaded" });
  await expect(page.locator("header").first()).toBeVisible();
  await expect(page.locator("footer").first()).toBeVisible();
});
