import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { prisma } from "#server/lib/prisma.ts";
import { PrismaFraudRepository } from "#server/modules/fraud/fraud.repository.ts";
import { getFraudRuleConfigFromEnv } from "#server/modules/fraud/fraud.rules.ts";
import { FraudService } from "#server/modules/fraud/fraud.service.ts";
import { numericThresholdFixture, thresholdContext, thresholdSale } from "#server/test-support/numeric-threshold.fixture.ts";
import en from "../messages/en.json" with { type: "json" };
import { newActorContext } from "./helpers/browser-context";
import { commerceFixture, loginUi, paymentEvent, placeOrderUi } from "./helpers/commerce-fixtures";
import { financeDatabase } from "./helpers/finance-fixtures";

test.use({ storageState: { cookies: [], origins: [] } });
test.afterAll(async () => { await prisma.$disconnect(); });

async function adminIdentity(db: ReturnType<typeof financeDatabase>) {
  const password = "DemoPass123!";
  const user = await db.user.create({ data: { email: `numeric-admin.${randomUUID()}@example.test`, name: "Numeric projections admin", role: "ADMIN", status: "ACTIVE", emailVerified: true } });
  await db.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(password), issuer: "local:credential" } });
  return { ...user, password };
}

function fraudService(db: ReturnType<typeof financeDatabase>) {
  return new FraudService(thresholdContext, new PrismaFraudRepository(thresholdContext, db), getFraudRuleConfigFromEnv({}));
}

async function evidence(page: Page, info: TestInfo, name: string, data: unknown) {
  await info.attach(name, { body: JSON.stringify(data, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2), contentType: "application/json" });
  const screenshot = info.outputPath(`${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await info.attach(`${name}-ui`, { path: screenshot, contentType: "image/png" });
}

async function caseApi(page: Page, id: string) {
  const response = await page.request.get(`/api/admin/fraud/cases/${id}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

test("refund count 3/6 produces displayed score75, 3/7 leaves its historical case, and admin reviews then resolves", async ({ page }, info) => {
  test.setTimeout(120_000);
  const db = financeDatabase();
  try {
    const admin = await adminIdentity(db);
    const f = await numericThresholdFixture(db);
    const service = fraudService(db);
    const sales = [];
    for (let index = 0; index < 6; index += 1) sales.push(await thresholdSale(db, f));
    const refunds = [];
    for (const [index, status] of (["PENDING", "FAILED", "SUCCESS"] as const).entries()) {
      const sale = sales[index]!;
      refunds.push(await db.refund.create({ data: { orderId: sale.order.id, paymentId: sale.payment.id, status, amount: 1n } }));
    }
    const target = refunds[0]!;
    expect(await db.order.count({ where: { userId: f.buyer.id } })).toBe(6);
    expect(await db.refund.count({ where: { order: { userId: f.buyer.id } } })).toBe(3);
    const atThreshold = await service.evaluateRefundRisk(target.id);
    expect(atThreshold).toMatchObject({ riskScore: 75, riskLevel: "high", reasons: ["high_refund_rate"], blocked: false, case: { riskScore: 75, status: "OPEN" } });
    expect(await service.evaluateRefundRisk(target.id)).toMatchObject({ riskScore: 75, case: { id: atThreshold.case!.id } });
    expect(await db.fraudCase.count({ where: { entityType: "REFUND", entityId: target.id } })).toBe(1);
    await loginUi(page, admin, "/en/admin/fraud");
    const row = page.getByRole("row").filter({ hasText: target.id });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("cell").nth(1).getByText("75", { exact: true })).toBeVisible();
    await expect(row.getByRole("cell").nth(1)).toContainText(en.admin.statuses.high);
    await expect(row).toContainText("high_refund_rate");
    const caseId = atThreshold.case!.id;
    const openApi = await caseApi(page, caseId);
    expect(openApi).toMatchObject({ id: caseId, riskScore: 75, riskLevel: "high", status: "OPEN", reasons: ["high_refund_rate"] });
    expect(await db.fraudCase.findUniqueOrThrow({ where: { id: caseId } })).toMatchObject({ riskScore: 75, status: "OPEN" });
    await thresholdSale(db, f);
    const belowThreshold = await service.evaluateRefundRisk(target.id);
    expect(belowThreshold).toMatchObject({ riskScore: 0, riskLevel: "low", reasons: [], case: null });
    expect(await db.order.count({ where: { userId: f.buyer.id } })).toBe(7);
    expect(await db.refund.count({ where: { order: { userId: f.buyer.id } } })).toBe(3);
    expect(await caseApi(page, caseId)).toMatchObject({ riskScore: 75, status: "OPEN" });
    await page.reload();
    await expect(row.getByRole("cell").nth(1).getByText("75", { exact: true })).toBeVisible();
    const reviewResponse = page.waitForResponse(r => r.url().endsWith(`/api/admin/fraud/cases/${caseId}/review`) && r.request().method() === "PATCH");
    await row.getByRole("button", { name: en.admin.ui.review, exact: true }).click();
    const reviewed = await reviewResponse;
    expect(reviewed.ok(), await reviewed.text()).toBeTruthy();
    expect(await reviewed.json()).toMatchObject({ riskScore: 75, status: "REVIEWED", reviewedBy: admin.id });
    await expect(row.getByRole("cell").nth(3)).toHaveText(en.admin.statuses.REVIEWED);
    const reviewedDb = await db.fraudCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(reviewedDb).toMatchObject({ riskScore: 75, status: "REVIEWED", reviewedById: admin.id });
    expect(reviewedDb.reviewedAt).not.toBeNull();
    const resolveResponse = page.waitForResponse(r => r.url().endsWith(`/api/admin/fraud/cases/${caseId}/resolve`) && r.request().method() === "PATCH");
    await row.getByRole("button", { name: en.admin.ui.resolve, exact: true }).click();
    const resolved = await resolveResponse;
    expect(resolved.ok(), await resolved.text()).toBeTruthy();
    expect(await resolved.json()).toMatchObject({ riskScore: 75, status: "RESOLVED" });
    await expect(row.getByRole("cell").nth(3)).toHaveText(en.admin.statuses.RESOLVED);
    await expect(row.getByRole("button", { name: en.admin.ui.review, exact: true })).toBeDisabled();
    await expect(row.getByRole("button", { name: en.admin.ui.resolve, exact: true })).toBeDisabled();
    const resolvedApi = await caseApi(page, caseId);
    const resolvedDb = await db.fraudCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(resolvedApi).toMatchObject({ riskScore: 75, status: "RESOLVED" });
    expect(resolvedDb).toMatchObject({ riskScore: 75, status: "RESOLVED", reviewedById: admin.id });
    await evidence(page, info, "fraud-refund-threshold-and-workflow", { oracle: { refundRows: 3, ordersAtThreshold: 6, ordersBelowThreshold: 7, scoreAtThreshold: 75, scoreBelowThreshold: 0 }, ratioDisplayedInUi: false, atThreshold, belowThreshold, openApi, resolvedApi, reviewedDb, resolvedDb });
  } finally {
    await db.$disconnect();
  }
});

test("combined order fraud signals cap at displayed score100 and duplicate evaluation persists one case", async ({ page }, info) => {
  test.setTimeout(120_000);
  const db = financeDatabase();
  try {
    const admin = await adminIdentity(db);
    const f = await numericThresholdFixture(db);
    for (let index = 0; index < 3; index += 1) await thresholdSale(db, f, { status: "CANCELED", paymentStatus: "FAILED", paymentState: "FAILED" });
    const sale = await thresholdSale(db, f, { amount: 100000n, checkoutCreatedAt: new Date("2026-10-04T00:00:00Z"), createdAt: new Date("2026-10-04T00:01:00Z") });
    const service = fraudService(db);
    const evaluations = await Promise.all([service.evaluateOrderRisk(sale.order.id), service.evaluateOrderRisk(sale.order.id)]);
    const reasons = ["many_failed_payments", "abnormal_order_amount", "suspicious_rapid_checkout", "repeated_cancelled_orders"];
    for (const result of evaluations) expect(result).toMatchObject({ riskScore: 100, riskLevel: "critical", reasons, blocked: false, case: { riskScore: 100 } });
    expect(await db.payment.count({ where: { order: { userId: f.buyer.id }, status: "FAILED" } })).toBe(3);
    expect(await db.order.count({ where: { userId: f.buyer.id, status: "CANCELED" } })).toBe(3);
    const cases = await db.fraudCase.findMany({ where: { entityType: "ORDER", entityId: sale.order.id } });
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ riskScore: 100, riskLevel: "critical", reasons });
    await loginUi(page, admin, "/en/admin/fraud");
    const row = page.getByRole("row").filter({ hasText: sale.order.id });
    await expect(row.getByRole("cell").nth(1).getByText("100", { exact: true })).toBeVisible();
    await expect(row.getByRole("cell").nth(1)).toContainText(en.admin.statuses.critical);
    for (const reason of reasons) await expect(row).toContainText(reason);
    const api = await caseApi(page, cases[0]!.id);
    expect(api).toMatchObject({ riskScore: 100, riskLevel: "critical", reasons, status: "OPEN" });
    await evidence(page, info, "fraud-score100-parity", { oracle: { failedPayments: 3, cancelledOrders: 3, amountCents: "100000", checkoutSeconds: 60, score: 100 }, evaluations, api, db: cases[0] });
  } finally {
    await db.$disconnect();
  }
});

for (const scenario of [
  { gross: 10000n, net: 9999n, paid: 14999n, coins: "0", ledger: [] },
  { gross: 10001n, net: 10000n, paid: 15000n, coins: "1", ledger: [1n] },
  { gross: 10002n, net: 10001n, paid: 15001n, coins: "1", ledger: [1n] },
] as const) {
  test(`internal mock payment awards ${scenario.coins} cashback coins for original NET ${scenario.net} excluding shipping`, async ({ page, browser, baseURL }, info) => {
    test.setTimeout(150_000);
    const db = financeDatabase();
    const adminContext = await newActorContext(browser, { baseURL });
    const adminPage = await adminContext.newPage();
    let originalPolicy: Record<string, unknown> | undefined;
    try {
      const admin = await adminIdentity(db);
      await loginUi(adminPage, admin, "/en/admin/settings");
      const policyResponse = await adminPage.request.get("/api/admin/checkout/tax-policy");
      expect(policyResponse.ok(), await policyResponse.text()).toBeTruthy();
      const policyBody = await policyResponse.json();
      expect(policyBody).toMatchObject({ settlementEnabled: true });
      originalPolicy = policyBody.policy;
      const zeroTax = await adminPage.request.put("/api/admin/checkout/tax-policy", { data: { ratePpm: 0, mode: "INCLUSIVE", fundingBasis: "SELLER_AFTER_SHOP_COUPON", taxableShipping: false, shippingBasis: "SELLER_SHIPPING_AFTER_WAIVER", rounding: "LINE_HALF_UP", custodian: "SELLER", exclusiveTaxFunding: "BUYER" } });
      expect(zeroTax.ok(), await zeroTax.text()).toBeTruthy();
      const f = await commerceFixture();
      const shop = f.shops[0]!;
      await db.buyerCoinWallet.update({ where: { id: f.wallet.id }, data: { balance: 0n } });
      await db.productVariant.update({ where: { id: shop.variant.id }, data: { price: scenario.gross } });
      await db.shopSetting.create({ data: { shopId: shop.shop.id, shippingFee: 5000n } });
      const coupon = await db.coupon.create({ data: { shopId: shop.shop.id, code: randomUUID().toUpperCase(), discountType: "FIXED_AMOUNT", discountValue: 1n, isActive: true } });
      await db.cart.create({ data: { userId: f.buyer.id, items: { create: { variantId: shop.variant.id, quantity: 1, unitPrice: scenario.gross } } } });
      await loginUi(page, f.buyer, "/en/checkout");
      await page.getByLabel(en.checkout.shopCoupon, { exact: true }).fill(coupon.code);
      await page.getByRole("button", { name: en.checkout.applyShopCoupon, exact: true }).click();
      await expect(page.getByText(en.checkout.couponApplied.replace("{code}", coupon.code), { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: en.checkout.placeOrder })).toBeEnabled();
      const result = await placeOrderUi(page);
      expect(result.totalCents).toBe(scenario.paid.toString());
      const snapshot = await db.itemSaleSnapshot.findFirstOrThrow({ where: { orderItem: { orderId: result.orderId } } });
      expect(snapshot).toMatchObject({ grossMerchandise: scenario.gross, sellerCouponDiscount: 1n, buyerMerchandiseNet: scenario.net, buyerMerchandiseTax: 0n, originalCashbackEligibleNet: scenario.net });
      const shopSnapshot = await db.shopSaleSnapshot.findFirstOrThrow({ where: { shopOrder: { orderId: result.orderId } } });
      expect(shopSnapshot).toMatchObject({ policyVersion: 2, buyerShipping: 5000n, reportedTaxTotal: 0n });
      expect(await db.payment.findUniqueOrThrow({ where: { id: result.paymentId } })).toMatchObject({ provider: "mock", amount: scenario.paid, status: "PENDING" });
      expect(await db.buyerCoinLedger.count({ where: { orderId: result.orderId, referenceType: "ORDER_CASHBACK" } })).toBe(0);
      await paymentEvent(page, result, "payment.paid");
      await paymentEvent(page, result, "payment.paid");
      expect(await db.payment.findUniqueOrThrow({ where: { id: result.paymentId } })).toMatchObject({ amount: scenario.paid, status: "SUCCEEDED" });
      const wallet = await db.buyerCoinWallet.findUniqueOrThrow({ where: { userId: f.buyer.id } });
      expect(wallet).toMatchObject({ balance: BigInt(scenario.coins), lifetimeEarned: BigInt(scenario.coins), pendingBalance: 0n, debtBalance: 0n });
      const ledger = await db.buyerCoinLedger.findMany({ where: { orderId: result.orderId, referenceType: "ORDER_CASHBACK" } });
      expect(ledger.map(entry => entry.amount)).toEqual(scenario.ledger);
      await page.goto("/en/coins");
      const apiResponse = await page.request.get("/api/me/coins");
      expect(apiResponse.ok(), await apiResponse.text()).toBeTruthy();
      const api = await apiResponse.json();
      expect(api).toMatchObject({ balance: scenario.coins, lifetimeEarned: scenario.coins, pendingBalance: "0", debtBalance: "0" });
      expect(api.entries).toHaveLength(scenario.ledger.length);
      if (scenario.ledger.length) expect(api.entries).toMatchObject([{ amount: "1", type: "EARNED", status: "AVAILABLE", orderId: result.orderId }]);
      const available = page.getByText(en.coins.available, { exact: true }).locator("..");
      const lifetime = page.getByText(en.coins.lifetimeEarned, { exact: true }).locator("..");
      await expect(available.getByText(scenario.coins, { exact: true })).toBeVisible();
      await expect(lifetime.getByText(scenario.coins, { exact: true })).toBeVisible();
      if (scenario.ledger.length) {
        const entry = page.locator("article").filter({ hasText: "1% order cashback" });
        await expect(entry).toHaveCount(1);
        await expect(entry.getByText("+1", { exact: true })).toBeVisible();
        await expect(entry).toContainText(en.coins.statuses.AVAILABLE);
      } else {
        await expect(page.getByText(en.coins.emptyTitle, { exact: true })).toBeVisible();
      }
      await evidence(page, info, "cashback-threshold-parity", { internalMockSimulation: true, externalProviderVerified: false, oracle: { grossCents: scenario.gross, sellerCouponCents: "1", originalNetCents: scenario.net, shippingCents: "5000", paidCents: scenario.paid, cashbackCoins: scenario.coins }, snapshot, shopSnapshot, wallet, ledger, api });
    } finally {
      if (originalPolicy) {
        const { ratePpm, mode, fundingBasis, taxableShipping, shippingBasis, rounding, custodian, exclusiveTaxFunding } = originalPolicy;
        const restored = await adminPage.request.put("/api/admin/checkout/tax-policy", { data: { ratePpm, mode, fundingBasis, taxableShipping, shippingBasis, rounding, custodian, exclusiveTaxFunding } });
        expect(restored.ok(), await restored.text()).toBeTruthy();
      }
      await adminContext.close();
      await db.$disconnect();
    }
  });
}
