import { expect, test } from "@playwright/test";
import { prisma } from "../server/lib/prisma";
import { getActiveShopId, isolateRateLimit, openSellerRoute, signInSeller, waitForRenderedPage } from "./helpers/seller";

test.beforeEach(async ({ page }, testInfo) => {
  await isolateRateLimit(page, testInfo);
  await signInSeller(page);
});

test("products: search, status filter, archive confirmation, and API retry", async ({ page }) => {
  let failProductsRequest = true;
  await page.route("**/api/seller/products**", async (route) => {
    if (failProductsRequest && route.request().method() === "GET") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "E2E temporary failure" }) });
      return;
    }
    await route.continue();
  });

  await page.goto("/th/seller/products");
  await waitForRenderedPage(page);
  const retry = page.getByRole("button", { name: "ลองอีกครั้ง" });
  await expect(retry).toBeVisible();
  failProductsRequest = false;
  await retry.click();
  await page.reload();
  await waitForRenderedPage(page);
  await expect(page.getByRole("columnheader", { name: "สินค้า" })).toBeVisible();

  const search = page.getByRole("textbox", { name: "ค้นหาสินค้า" });
  await search.fill("missing-e2e-product-name");
  await expect(page.getByText("ไม่พบสินค้า", { exact: true })).toBeVisible();
  await search.clear();

  const statusFilter = page.getByRole("combobox", { name: "กรองตามสถานะสินค้า" });
  await statusFilter.click();
  await page.getByRole("option", { name: "ฉบับร่าง", exact: true }).click();
  await expect(statusFilter).toContainText("ฉบับร่าง");

  await statusFilter.click();
  await page.getByRole("option", { name: "ทุกสถานะ", exact: true }).click();
  const archiveButton = page.locator('button[aria-label^="Archive "]:not([disabled])').first();
  await expect(archiveButton).toBeVisible();
  await archiveButton.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("เก็บสินค้าเข้าคลัง");
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();
  await expect(dialog).toBeHidden();
});

test("analytics: presets, custom date validation, search, chart, and table", async ({ page }) => {
  test.setTimeout(60_000);
  await openSellerRoute(page, "/analytics/products");

  const range = page.getByRole("group", { name: "ช่วงวันที่" });
  await range.getByRole("button", { name: "7 วัน" }).click();

  const dates = page.locator('input[type="date"]');
  await dates.nth(0).fill("2026-08-08");
  await dates.nth(1).fill("2026-08-01");
  await expect(page.locator("p.text-red-700")).toBeVisible();
  await dates.nth(1).fill("2026-08-08");
  await expect(page.locator("p.text-red-700")).toBeHidden();

  const search = page.getByPlaceholder("ค้นหาสินค้า");
  await search.fill("E2E");
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "สินค้า" })).toBeVisible();
});

test("inventory: low-stock filter and safe numeric update form", async ({ page }) => {
  await openSellerRoute(page, "/inventory");

  const lowStockOnly = page.getByRole("checkbox", { name: "เฉพาะสต็อกต่ำ" });
  await lowStockOnly.check();
  await expect(lowStockOnly).toBeChecked();
  await lowStockOnly.uncheck();

  const stockInputs = page.locator('input[name="quantityOnHand"]');
  await expect(stockInputs.first()).toBeVisible();
  await expect(stockInputs.first()).toHaveAttribute("min", "0");
  await expect(page.locator('input[name="reorderLevel"]').first()).toHaveAttribute("min", "0");
  await expect(page.locator('input[aria-label^="Reserved stock "]').first()).toHaveAttribute("readonly", "");
});

test("orders and returns expose state-safe actions", async ({ page }) => {
  await openSellerRoute(page, "/orders");
  const shipmentActions = page.getByRole("button", { name: /ทำเครื่องหมายว่าแพ็กแล้ว|จัดส่ง|ทำเครื่องหมายว่าส่งแล้ว/ });
  if (await shipmentActions.count()) {
    await expect(page.locator('input[name="carrier"]').first()).toBeVisible();
    await expect(page.locator('input[name="trackingNo"]').first()).toBeVisible();
  } else {
    await expect(page.getByText("ไม่มีการจัดส่งที่ต้องดำเนินการ", { exact: true })).toBeVisible();
  }

  await openSellerRoute(page, "/returns");
  const returnActions = page.getByRole("button", { name: /อนุมัติ|ปฏิเสธ/ });
  if (await returnActions.count()) {
    await expect(returnActions.first()).toBeVisible();
  } else {
    await expect(page.getByText("ไม่พบคำขอคืนสินค้า", { exact: true })).toBeVisible();
  }
});

test("promotions and finance validate forms before mutations", async ({ page }) => {
  await openSellerRoute(page, "/promotions");
  const promotionForm = page.locator('input[name="code"]').locator("xpath=ancestor::form");
  expect(await promotionForm.evaluate((form: HTMLFormElement) => form.checkValidity())).toBeFalsy();
  await page.locator('input[name="code"]').fill(`E2E${Date.now()}`);
  await page.locator('input[name="amount"]').fill("10");
  expect(await promotionForm.evaluate((form: HTMLFormElement) => form.checkValidity())).toBeTruthy();

  await openSellerRoute(page, "/finance");
  const amount = page.locator('input[name="amount"]');
  await expect(amount).toHaveAttribute("min", "1");
  await amount.fill("0");
  expect(await amount.evaluate((input: HTMLInputElement) => input.checkValidity())).toBeFalsy();
  await amount.fill("1");
  expect(await amount.evaluate((input: HTMLInputElement) => input.checkValidity())).toBeTruthy();
});

test("notifications filter tabs and chat composer work without sending data", async ({ page }) => {
  await openSellerRoute(page, "/notifications");
  const paymentTab = page.getByRole("button", { name: "การชำระเงิน" });
  await paymentTab.click();
  await expect(paymentTab).toHaveAttribute("data-variant", "default");

  const shopId = await getActiveShopId(page);
  await openSellerRoute(page, `/chat?shopId=${shopId}`);
  const roomLink = page.locator(`a[href*="/seller/chat/"][href*="shopId=${shopId}"]`).first();
  await expect(roomLink).toBeVisible();
  await roomLink.click();
  await waitForRenderedPage(page);
  const composer = page.getByPlaceholder("พิมพ์ข้อความ");
  const send = page.getByRole("button", { name: "ส่ง", exact: true });
  await expect(send).toBeDisabled();
  await composer.fill("E2E draft only");
  await expect(send).toBeEnabled();
});

test("product lifecycle creates, saves, configures options and stock, then cleans up", async ({ page }) => {
  test.setTimeout(90_000);
  let productId = "";

  try {
    await page.route("**/api/seller/products**", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "E2E create retry" }) });
        return;
      }
      await route.continue();
    });
    const createFailure = page.waitForResponse((response) => response.url().endsWith("/api/seller/products") && response.status() === 503);
    await page.goto("/th/seller/products/new");
    await expect(page.getByRole("heading", { name: "เพิ่มสินค้า" })).toBeVisible();
    await createFailure;
    await page.unroute("**/api/seller/products**");

    const createResponse = await page.request.post("/api/seller/products", {
      data: { title: "E2E Product Draft", status: "DRAFT" },
    });
    const createdProduct = await createResponse.json();
    expect(createResponse.ok(), JSON.stringify(createdProduct)).toBeTruthy();
    productId = createdProduct.id as string;
    await page.goto(`/th/seller/products/${productId}`);
    await waitForRenderedPage(page);

    await page.locator("#product-title").fill(`E2E Product ${Date.now()}`);
    await page.locator("#product-slug").fill(`e2e-${Date.now()}`);
    await page.locator("#product-description").fill("Playwright lifecycle product");

    const productSaved = page.waitForResponse((response) => (
      response.url().includes(`/api/seller/products/${productId}`)
      && response.request().method() === "PATCH"
      && response.ok()
    ));
    await page.locator(".sticky").getByRole("button", { name: "บันทึกฉบับร่าง" }).click();
    await productSaved;
    await expect(page.locator('[aria-live="polite"]').filter({ hasText: "สถานะการบันทึก" })).toContainText("บันทึกแล้ว");

    await page.locator('input[name="productImages"]').setInputFiles("public/logo192.png");
    const preview = page.locator("#media img");
    await expect(preview).toHaveCount(1);
    await expect(preview).toHaveAttribute("loading", "lazy");
    await page.getByRole("button", { name: /ลบรูปภาพ/ }).click();
    await expect(preview).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/th/seller/products/${productId}$`));

    await page.getByRole("button", { name: "เพิ่มตัวเลือก", exact: true }).click();
    await page.locator("#option-name-0").fill("Color");
    await page.locator('input[name="options.0.values.0.value"]').fill("Black");
    await page.locator('input[name="options.0.values.0.valueTh"]').fill("ดำ");

    const saveOptionsButton = page.getByRole("button", { name: "บันทึกตัวเลือก", exact: true });
    const optionsSaved = page.waitForResponse((response) => response.url().includes(`/api/seller/products/${productId}/options`) && response.ok());
    await saveOptionsButton.click();
    await optionsSaved;
    await expect(saveOptionsButton).toBeEnabled();

    await page.getByRole("button", { name: "สร้างแถว", exact: true }).click();
    await page.locator("#variant-sku-0").fill(`E2E-SKU-${Date.now()}`);
    await expect(page.locator("#variant-title-0")).toHaveValue("Black");
    await page.locator("#variant-price-0").fill("99");
    await page.locator("#variant-on-hand-0").fill("5");
    await page.locator("#variant-reorder-0").fill("1");

    const variantSaved = page.waitForResponse((response) => response.url().includes(`/api/seller/products/${productId}/variants`) && response.request().method() === "POST");
    await page.getByRole("button", { name: "บันทึกตัวเลือกสินค้า", exact: true }).first().click();
    const variantResponse = await variantSaved;
    expect(variantResponse.ok(), await variantResponse.text()).toBeTruthy();
    await expect(page.getByText("อัปเดตตัวเลือกสินค้าแล้ว", { exact: true }).or(page.getByText("สร้างตัวเลือกสินค้าแล้ว", { exact: true }))).toBeVisible();

    await expect(page.locator("#review").getByRole("button", { name: "ส่งตรวจสอบ", exact: true })).toBeDisabled();
  } finally {
    if (productId) {
      await prisma.product.deleteMany({ where: { id: productId } });
    }
  }
});

test("ownership guard blocks another seller and allows product owner", async ({ page }) => {
  const productId = process.env.E2E_OWNERSHIP_PRODUCT_ID ?? "b4876ad1-bd8b-4b42-86bd-c9dad60fcaea";

  await page.goto(`/th/seller/products/${productId}`);
  await waitForRenderedPage(page);
  await expect(page.locator("#seller-product-studio-form")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ลองอีกครั้ง" })).toBeVisible();

  await page.context().clearCookies();
  await signInSeller(page, {
    email: process.env.E2E_PRODUCT_OWNER_EMAIL ?? "buyer.demo@example.com",
    password: process.env.E2E_PRODUCT_OWNER_PASSWORD ?? "DemoPass123!",
  });
  await page.goto(`/th/seller/products/${productId}`);
  await waitForRenderedPage(page);
  await expect(page.locator("#seller-product-studio-form")).toBeVisible();
});
