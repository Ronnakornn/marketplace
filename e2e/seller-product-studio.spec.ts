import { expect, test } from "@playwright/test";
import { isolateRateLimit, openProductStudio, signInSeller } from "./helpers/seller";

test.beforeEach(async ({ page }, testInfo) => {
  await isolateRateLimit(page, testInfo);
  await signInSeller(page);
  await openProductStudio(page);
});

test("renders the Thai full-width Product Studio without the old accent text", async ({ page }) => {
  const studioNav = page.getByRole("navigation", { name: "ส่วนต่าง ๆ ของสตูดิโอสินค้า" });
  await expect(studioNav).toContainText("ข้อมูลพื้นฐาน");
  await expect(studioNav).toContainText("สื่อ");
  await expect(studioNav).toContainText("ตัวเลือกสินค้า");
  await expect(studioNav).toContainText("ตรวจสอบ");

  await expect(page.getByText("แถวตัวเลือกสินค้า", { exact: true })).toBeVisible();
  await expect(page.getByText("สร้าง แก้ไข ลบ ตั้งราคา ขนาด และสต็อกสำหรับชุดตัวเลือกที่ขายได้", { exact: true })).toBeVisible();

  const body = page.locator("body");
  await expect(body).not.toContainText("Up to two axes. Current option values can generate");
  await expect(body).not.toContainText("No structured options yet.");
  await expect(body).not.toContainText("Variant rows");
  await expect(body).not.toContainText("Create, edit, delete, price, dimensions, and stock setup");

  const sectionLayout = await page.locator("#seller-product-studio-form").evaluate((form) => {
    const formWidth = form.getBoundingClientRect().width;
    const sectionIds = ["basics", "category-specs", "media", "variants", "inventory", "review"];
    return {
      formWidth,
      viewportWidth: window.innerWidth,
      sectionWidths: sectionIds.map((id) => {
        const section = document.getElementById(id);
        return { id, width: section?.getBoundingClientRect().width ?? 0 };
      }),
    };
  });

  expect(sectionLayout.formWidth).toBeGreaterThan(sectionLayout.viewportWidth * 0.65);
  for (const section of sectionLayout.sectionWidths) {
    expect(section.width, `${section.id} should use the full Product Studio width`).toBeGreaterThanOrEqual(sectionLayout.formWidth * 0.98);
  }

  const oldAccentOffenders = await page.locator("header").evaluate((header) => {
    const oldAccent = "rgb(141,229,219)";
    return Array.from(header.querySelectorAll("a, button, span, svg, path"))
      .filter((element) => {
        const styles = getComputedStyle(element);
        return [styles.color, styles.stroke, styles.fill]
          .map((value) => value.replaceAll(" ", "").toLowerCase())
          .includes(oldAccent);
      })
      .map((element) => element.outerHTML.slice(0, 180));
  });
  expect(oldAccentOffenders, "Header text and icons must not use #8de5db").toEqual([]);
});

test("exposes stable form, live-region, numeric, and media semantics", async ({ page }) => {
  const form = page.locator("#seller-product-studio-form");
  await expect(form).toHaveAttribute("autocomplete", "off");
  await expect(page.locator("#product-title")).toHaveAttribute("name", "title");
  await expect(page.locator("#bulk-price")).toHaveAttribute("name", "bulkPrice");
  await expect(page.locator("#bulk-stock")).toHaveAttribute("name", "bulkStock");
  await expect(page.locator("#bulk-price")).toHaveClass(/tabular-nums/);
  await expect(page.locator("#bulk-stock")).toHaveClass(/tabular-nums/);

  const saveState = page.locator('[aria-live="polite"]').filter({ hasText: "สถานะการบันทึก" });
  await expect(saveState).toBeVisible();
  await expect(saveState).toHaveAttribute("aria-atomic", "true");

  const mediaImages = page.locator("#media img");
  if (await mediaImages.count() === 0) {
    await page.locator('input[name="productImages"]').setInputFiles("public/logo192.png");
    await expect(mediaImages).toHaveCount(1);
  }
  const mediaImageCount = await mediaImages.count();
  for (let index = 0; index < mediaImageCount; index += 1) {
    const image = mediaImages.nth(index);
    await expect(image).toHaveAttribute("width", /\d+/);
    await expect(image).toHaveAttribute("height", /\d+/);
    await expect(image).toHaveAttribute("loading", "lazy");
  }
});

test("warns before discarding unsaved changes without leaving the page", async ({ page }) => {
  const title = page.locator("#product-title");
  const originalTitle = await title.inputValue();
  const changedTitle = `${originalTitle} automation`;
  await title.fill(changedTitle);

  const saveState = page.locator('[aria-live="polite"]').filter({ hasText: "สถานะการบันทึก" });
  await expect(saveState).toContainText("ยังไม่บันทึก");

  const beforeUnload = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    const dispatched = window.dispatchEvent(event);
    return { dispatched, defaultPrevented: event.defaultPrevented };
  });
  expect(beforeUnload).toEqual({ dispatched: false, defaultPrevented: true });

  await page.locator(".sticky").getByRole("button", { name: "ยกเลิก", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("ละทิ้งการเปลี่ยนแปลงที่ยังไม่บันทึกหรือไม่");

  await dialog.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(title).toHaveValue(changedTitle);
});

test("uses an accessible confirmation dialog before deleting a variant", async ({ page }) => {
  const deleteVariant = page.getByRole("button", { name: "ลบตัวเลือกสินค้า", exact: true }).first();
  if (await deleteVariant.count() === 0) {
    await page.getByRole("button", { name: "เพิ่มตัวเลือกสินค้า", exact: true }).click();
  }
  await expect(deleteVariant).toBeVisible();
  await deleteVariant.click();

  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("ลบตัวเลือกสินค้าหรือไม่");

  await dialog.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(dialog).toBeHidden();
});
