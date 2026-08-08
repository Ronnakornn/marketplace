import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import th from "../messages/th.json" with { type: "json" };
import { getActiveShopId, isolateRateLimit, openSellerRoute, signInSeller } from "./helpers/seller";

const routes = [
  "",
  "/products",
  "/analytics/products",
  "/inventory",
  "/orders",
  "/returns",
  "/promotions",
  "/finance",
  "/chat",
  "/notifications",
  "/status",
  "/register",
] as const;

const tableHeadings = {
  "/products": { en: en.seller.products.product, th: th.seller.products.product },
  "/analytics/products": { en: en.seller.analytics.product, th: th.seller.analytics.product },
  "/inventory": { en: en.seller.manage.pages.inventory.variant, th: th.seller.manage.pages.inventory.variant },
  "/returns": { en: en.seller.manage.pages.returns.return, th: th.seller.manage.pages.returns.return },
  "/promotions": { en: en.seller.manage.pages.promotions.coupon, th: th.seller.manage.pages.promotions.coupon },
} as const;

test.beforeEach(async ({ page }, testInfo) => {
  await isolateRateLimit(page, testInfo);
  await signInSeller(page);
});

for (const locale of ["th", "en"] as const) {
  test(`${locale}: every seller route renders without runtime errors`, async ({ page }) => {
    test.setTimeout(60_000);
    const shopId = await getActiveShopId(page);

    for (const path of routes) {
      await test.step(path || "/seller", async () => {
        const separator = path.includes("?") ? "&" : "?";
        await openSellerRoute(page, `${path}${separator}shopId=${shopId}`, locale);
        await expect(page).toHaveURL(new RegExp(`/${locale}/seller`));
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByRole("heading").first()).toBeVisible();

        if (path in tableHeadings) {
          const heading = tableHeadings[path as keyof typeof tableHeadings][locale];
          await expect(page.getByRole("columnheader", { name: heading }).first()).toBeVisible();
        }
      });
    }
  });
}
