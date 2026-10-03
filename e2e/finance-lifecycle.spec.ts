import { newActorContext } from './helpers/browser-context';
import { expect, test, type Page, type Locator, type Browser, type BrowserContext } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { createFinanceFixture, financeDatabase } from "./helpers/finance-fixtures";

async function actorPage(browser: Browser, baseURL: string | undefined, contexts: BrowserContext[]) {
  const context = await newActorContext(browser, { baseURL, storageState: { cookies: [], origins: [] } });
  contexts.push(context);
  return context.newPage();
}

async function login(page: Page, identity: { email: string; password: string }, path: string) {
  await page.goto(`/en/login?next=${encodeURIComponent(path)}`);
  await page.getByLabel(en.auth.email, { exact: true }).fill(identity.email);
  await page.getByLabel(en.auth.password, { exact: true }).fill(identity.password);
  await page.getByRole("button", { name: en.auth.signIn, exact: true }).click();
  await expect(page).toHaveURL(path);
}

async function refundStatus(page: Page, row: Locator, status: "PROCESSING" | "SUCCESS", reference?: string) {
  await row.getByRole("combobox").click();
  await page.getByRole("option", { name: en.admin.statuses[status], exact: true }).click();
  if (reference) page.once("dialog", (dialog) => dialog.accept(reference));
  const response = page.waitForResponse((r) => r.url().includes("/api/admin/refunds/") && r.request().method() === "PATCH");
  await page.getByRole("alertdialog").getByRole("button", { name: en.admin.common.confirm, exact: true }).click();
  return await response;
}

test("partial discounted return is approved and refunded once with the correct seller debit", async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const db = financeDatabase();
  const contexts: BrowserContext[] = [];
  try {
    const f = await createFinanceFixture(db);
    const buyer = await actorPage(browser, baseURL, contexts);
    await login(buyer, f.buyer, `/en/orders/${f.order.id}/returns/new`);
    await buyer.locator(`input[name="returnItem"][value="${f.items[0].id}"]`).check();
    await buyer.getByLabel(en.buyer.details).fill("Partial order return after discount");
    await buyer.getByRole("button", { name: en.buyer.submitRequest }).click();
    await expect(buyer.getByText(en.buyer.returnSubmitted)).toBeVisible();
    await buyer.context().close();
    const seller = await actorPage(browser, baseURL, contexts);
    await login(seller, f.seller, "/en/seller/returns");
    const returnRow = seller.getByRole("row").filter({ hasText: f.items[0].productTitle });
    await returnRow.getByRole("button", { name: en.seller.manage.pages.returns.approve, exact: true }).click();
    await expect.poll(() => db.refund.count({ where: { orderId: f.order.id } })).toBe(1);
    const refund = await db.refund.findFirstOrThrow({ where: { orderId: f.order.id } });
    expect(refund.amount).toBe(3200n); // 40% of the 8,000 net merchandise; shipping is excluded.
    const request = await db.returnRequest.findUniqueOrThrow({ where: { id: refund.returnRequestId! }, include: { items: true } });
    expect(request.items).toHaveLength(1);
    expect(request.items[0].orderItemId).toBe(f.items[0].id);
    const admin = await actorPage(browser, baseURL, contexts);
    await login(admin, f.admin, "/en/admin/refunds");
    const row = admin.getByRole("row").filter({ hasText: f.order.orderNumber });
    expect((await refundStatus(admin, row, "PROCESSING")).ok()).toBeTruthy();
    expect((await refundStatus(admin, row, "SUCCESS", "E2E-SAME-ADMIN")).status()).toBe(409);
    await admin.context().close();
    const completer = await actorPage(browser, baseURL, contexts);
    await login(completer, f.secondAdmin, "/en/admin/refunds");
    const completeRow = completer.getByRole("row").filter({ hasText: f.order.orderNumber });
    const completed = await refundStatus(completer, completeRow, "SUCCESS", `E2E-REFUND-${refund.id}`);
    expect(completed.ok(), await completed.text()).toBeTruthy();
    const duplicate = await completer.request.patch(`/api/admin/refunds/${refund.id}/status`, { data: { status: "SUCCESS", externalReference: `E2E-REFUND-${refund.id}` } });
    expect(duplicate.ok(), await duplicate.text()).toBeTruthy();
    expect(await duplicate.json()).toMatchObject({ status: 'SUCCESS' });
    const debits = await db.walletLedgerEntry.findMany({ where: { orderId: f.order.id, type: "refund_adjustment" } });
    expect(debits).toHaveLength(1);
    expect(debits[0]).toMatchObject({ amount: -3200n, shopId: f.shop.id });
    await seller.goto("/en/seller/finance");
    await expect(seller.getByText(/68\.00/).first()).toBeVisible();
  } finally {
    // Serialize WebKit context/video teardown; concurrent closes can stall its host.
    for (const context of contexts) await context.close();
    await db.$disconnect();
  }
});

test("snapshot refund plan shows seller-fault shipping before processing and reconciles UI API and DB", async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const db = financeDatabase();
  const contexts: BrowserContext[] = [];
  try {
    const f = await createFinanceFixture(db, true);
    const buyer = await actorPage(browser, baseURL, contexts);
    await login(buyer, f.buyer, `/en/orders/${f.order.id}/returns/new`);
    await buyer.locator(`input[name="returnItem"][value="${f.items[0].id}"]`).check();
    await buyer.getByLabel(en.buyer.details).fill("Seller supplied damaged goods");
    await buyer.getByRole("button", { name: en.buyer.submitRequest }).click();
    await expect(buyer.getByText(en.buyer.returnSubmitted)).toBeVisible();
    const seller = await actorPage(browser, baseURL, contexts);
    await login(seller, f.seller, "/en/seller/returns");
    await seller.getByRole("row").filter({ hasText: f.items[0].productTitle })
      .getByRole("button", { name: en.seller.manage.pages.returns.approve, exact: true }).click();
    await expect.poll(() => db.refund.count({ where: { orderId: f.order.id } })).toBe(1);
    const refund = await db.refund.findFirstOrThrow({ where: { orderId: f.order.id } });
    expect(refund.amount).toBe(3200n);
    const admin = await actorPage(browser, baseURL, contexts);
    await login(admin, f.admin, "/en/admin/refunds");
    const row = admin.getByRole("row").filter({ hasText: f.order.orderNumber });
    await expect(row).toContainText("32.00");
    await row.getByLabel(en.admin.refunds.confirmedSellerFaultShipping).check();
    await expect(row.getByRole("combobox")).toBeDisabled();
    const planResponse = admin.waitForResponse((response) => response.url().endsWith(`/api/admin/refunds/${refund.id}/plan`) && response.request().method() === "PATCH");
    await row.getByRole("button", { name: en.admin.refunds.updatePlan }).click();
    const plan = await planResponse;
    expect(plan.ok(), await plan.text()).toBeTruthy();
    expect(await plan.json()).toMatchObject({ amount: 3700, status: "PENDING" });
    await expect(row).toContainText("37.00");
    expect(await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({ amount: 3700n, status: "PENDING" });
    expect((await refundStatus(admin, row, "PROCESSING")).ok()).toBeTruthy();
    const completer = await actorPage(browser, baseURL, contexts);
    await login(completer, f.secondAdmin, "/en/admin/refunds");
    const completed = await refundStatus(completer, completer.getByRole("row").filter({ hasText: f.order.orderNumber }), "SUCCESS", `E2E-SNAPSHOT-${refund.id}`);
    expect(completed.ok(), await completed.text()).toBeTruthy();
    expect(await db.walletLedgerEntry.aggregate({ where: { walletId: f.wallet.id }, _sum: { amount: true } })).toMatchObject({ _sum: { amount: 4320n } });
    expect(await db.refundShopAllocation.findFirstOrThrow({ where: { refundId: refund.id } })).toMatchObject({ buyerShippingRefund: 500n, commissionReversal: 320n, shippingCause: "SELLER_FAULT" });
    await seller.goto("/en/seller/finance");
    await expect(seller.getByText(/43\.20/).first()).toBeVisible();
    await seller.screenshot({ path: "docs/test-evidence/2026-10-04-settlement-policy/seller-refund-balance.png", fullPage: true });
  } finally {
    for (const context of contexts) await context.close();
    await db.$disconnect();
  }
});

test("admin prepares paid cancellation cash before two-admin completion restores stock once", async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const db = financeDatabase();
  const contexts: BrowserContext[] = [];
  try {
    const f = await createFinanceFixture(db, true);
    await db.order.update({ where: { id: f.order.id }, data: { status: "PAID" } });
    await db.orderItem.updateMany({ where: { orderId: f.order.id }, data: { fulfillmentStatus: "PENDING" } });
    await db.shopOrder.updateMany({ where: { orderId: f.order.id }, data: { status: "PAID", fulfillmentStatus: "PENDING" } });
    await db.shopSaleSnapshot.updateMany({ where: { shopOrder: { orderId: f.order.id } }, data: { recognizedAt: null } });
    await db.shipment.updateMany({ where: { orderId: f.order.id }, data: { status: "PENDING_PACK", shippedAt: null, deliveredAt: null } });
    await db.walletLedgerEntry.deleteMany({ where: { walletId: f.wallet.id } });
    for (const item of f.items) {
      const inventory = await db.inventory.create({ data: { variantId: item.variantId, quantityOnHand: 9 } });
      await db.inventoryReservation.create({ data: { checkoutId: f.order.checkoutId, orderId: f.order.id, inventoryId: inventory.id,
        quantity: 1, status: "COMMITTED", expiresAt: new Date() } });
    }
    const admin = await actorPage(browser, baseURL, contexts);
    await login(admin, f.admin, "/en/admin/orders");
    const row = admin.getByRole("row").filter({ hasText: f.order.orderNumber });
    const prepared = admin.waitForResponse((response) => response.url().endsWith(`/api/admin/orders/${f.order.id}/refunds`) && response.request().method() === "POST");
    await row.getByRole("button", { name: en.admin.refunds.prepareCancellation }).click();
    const response = await prepared;
    expect(response.ok(), await response.text()).toBeTruthy();
    const record = await response.json();
    expect(record).toMatchObject({ status: "PENDING", amount: 8500 });
    expect(await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).toMatchObject({ status: "PAID" });
    await admin.goto("/en/admin/refunds");
    const refundRow = admin.getByRole("row").filter({ hasText: f.order.orderNumber });
    await expect(refundRow).toContainText("85.00");
    expect((await refundStatus(admin, refundRow, "PROCESSING")).ok()).toBeTruthy();
    const completer = await actorPage(browser, baseURL, contexts);
    await login(completer, f.secondAdmin, "/en/admin/refunds");
    expect((await refundStatus(completer, completer.getByRole("row").filter({ hasText: f.order.orderNumber }), "SUCCESS", `CANCEL-${record.id}`)).ok()).toBeTruthy();
    const replay = await completer.request.patch(`/api/admin/refunds/${record.id}/status`, { data: { status: "SUCCESS", externalReference: `CANCEL-${record.id}` } });
    expect(replay.ok(), await replay.text()).toBeTruthy();
    expect(await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).toMatchObject({ status: "REFUNDED", paymentStatus: "REFUNDED" });
    expect(await db.payment.findFirstOrThrow({ where: { orderId: f.order.id } })).toMatchObject({ status: "REFUNDED", amount: 8500n });
    expect(await db.inventory.findMany({ where: { variantId: { in: f.items.map((item) => item.variantId) } }, select: { quantityOnHand: true, quantityReserved: true } }))
      .toEqual([{ quantityOnHand: 10, quantityReserved: 0 }, { quantityOnHand: 10, quantityReserved: 0 }]);
    expect(await db.walletLedgerEntry.count({ where: { orderId: f.order.id } })).toBe(0);
  } finally {
    for (const context of contexts) await context.close();
    await db.$disconnect();
  }
});

test("seller payout reserves funds and two admins complete it without duplicate debits", async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const db = financeDatabase();
  const contexts: BrowserContext[] = [];
  try {
    const f = await createFinanceFixture(db);
    const seller = await actorPage(browser, baseURL, contexts);
    await login(seller, f.seller, "/en/seller/finance");
    await seller.getByPlaceholder(en.seller.manage.pages.finance.amount).fill("60");
    const pending = seller.waitForResponse((r) => r.url().endsWith("/api/seller/payouts") && r.request().method() === "POST");
    await seller.getByRole("button", { name: en.seller.manage.pages.finance.request, exact: true }).click();
    const created = await pending;
    expect(created.ok(), await created.text()).toBeTruthy();
    const payout = await db.sellerPayout.findFirstOrThrow({ where: { shopId: f.shop.id } });
    await expect(seller.getByText(/40\.00/).first()).toBeVisible();
    const repeated = await seller.request.post("/api/seller/payouts", { data: { amount: 6000 } });
    expect(repeated.status()).toBe(409);
    const admin = await actorPage(browser, baseURL, contexts);
    await login(admin, f.admin, "/en/admin/payouts");
    const row = admin.getByRole("row").filter({ hasText: payout.id });
    await row.getByRole("button", { name: en.admin.ui.approve, exact: true }).click();
    await expect(row.getByRole("button", { name: en.admin.ui.paid, exact: true })).toBeEnabled();
    const sameAdmin = await admin.request.patch(`/api/admin/payouts/${payout.id}/mark-paid`, { data: { externalReference: "E2E-SAME-ADMIN" } });
    expect(sameAdmin.status()).toBe(409);
    await admin.context().close();
    const completer = await actorPage(browser, baseURL, contexts);
    await login(completer, f.secondAdmin, "/en/admin/payouts");
    completer.once("dialog", (dialog) => dialog.accept(`E2E-PAYOUT-${payout.id}`));
    const paidResponse = completer.waitForResponse((r) => r.url().endsWith(`/payouts/${payout.id}/mark-paid`) && r.request().method() === "PATCH");
    await completer.getByRole("row").filter({ hasText: payout.id }).getByRole("button", { name: en.admin.ui.paid, exact: true }).click();
    const paid = await paidResponse;
    expect(paid.ok(), await paid.text()).toBeTruthy();
    const duplicate = await completer.request.patch(`/api/admin/payouts/${payout.id}/mark-paid`, { data: { externalReference: `E2E-PAYOUT-${payout.id}` } });
    expect(duplicate.status()).toBe(409);
    expect(await db.sellerPayout.count({ where: { shopId: f.shop.id } })).toBe(1);
    const balance = await db.walletLedgerEntry.aggregate({ where: { walletId: f.wallet.id }, _sum: { amount: true } });
    expect(balance._sum.amount).toBe(4000n);
    await seller.reload();
    await expect(seller.getByText(en.seller.manage.status.paid, { exact: true })).toBeVisible();
    await expect(seller.getByText(/40\.00/).first()).toBeVisible();
  } finally {
    for (const context of contexts) await context.close();
    await db.$disconnect();
  }
});

