import { test as setup } from "@playwright/test";
import { isolateRateLimit, signInSeller } from "./helpers/seller";

const authFile = "test-results/.auth/seller.json";

setup("authenticate seller", async ({ page }, testInfo) => {
  await isolateRateLimit(page, testInfo);
  await signInSeller(page);
  await page.context().storageState({ path: authFile });
});
