# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: finance-lifecycle.spec.ts >> three partial quantity returns preserve original included tax and cumulative rounding in UI API and DB
- Location: e2e\finance-lifecycle.spec.ts:221:1

# Error details

```
Error: locator.click: Error: strict mode violation: getByRole('row').filter({ hasText: 'Finance item 4000' }).filter({ has: getByRole('button', { name: 'Approve', exact: true }) }).getByRole('button', { name: 'Approve', exact: true }) resolved to 2 elements:
    1) <button data-size="sm" data-slot="button" data-variant="outline" class="inline-flex shrink-0 items-center justify-center text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 border …>Approve</button> aka getByRole('button', { name: 'Approve' }).first()
    2) <button disabled data-size="sm" data-slot="button" data-variant="outline" class="inline-flex shrink-0 items-center justify-center text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-…>Approve</button> aka getByRole('button', { name: 'Approve' }).nth(1)

Call log:
  - waiting for getByRole('row').filter({ hasText: 'Finance item 4000' }).filter({ has: getByRole('button', { name: 'Approve', exact: true }) }).getByRole('button', { name: 'Approve', exact: true })

```

# Test source

```ts
  153 |     await admin.goto("/en/admin/refunds");
  154 |     const refundRow = admin.getByRole("row").filter({ hasText: f.order.orderNumber });
  155 |     await expect(refundRow).toContainText("85.00");
  156 |     expect((await refundStatus(admin, refundRow, "PROCESSING")).ok()).toBeTruthy();
  157 |     const completer = await actorPage(browser, baseURL, contexts);
  158 |     await login(completer, f.secondAdmin, "/en/admin/refunds");
  159 |     expect((await refundStatus(completer, completer.getByRole("row").filter({ hasText: f.order.orderNumber }), "SUCCESS", `CANCEL-${record.id}`)).ok()).toBeTruthy();
  160 |     const replay = await completer.request.patch(`/api/admin/refunds/${record.id}/status`, { data: { status: "SUCCESS", externalReference: `CANCEL-${record.id}` } });
  161 |     expect(replay.ok(), await replay.text()).toBeTruthy();
  162 |     expect(await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).toMatchObject({ status: "REFUNDED", paymentStatus: "REFUNDED" });
  163 |     expect(await db.payment.findFirstOrThrow({ where: { orderId: f.order.id } })).toMatchObject({ status: "REFUNDED", amount: 8500n });
  164 |     expect(await db.inventory.findMany({ where: { variantId: { in: f.items.map((item) => item.variantId) } }, select: { quantityOnHand: true, quantityReserved: true } }))
  165 |       .toEqual([{ quantityOnHand: 10, quantityReserved: 0 }, { quantityOnHand: 10, quantityReserved: 0 }]);
  166 |     expect(await db.walletLedgerEntry.count({ where: { orderId: f.order.id } })).toBe(0);
  167 |   } finally {
  168 |     for (const context of contexts) await context.close();
  169 |     await db.$disconnect();
  170 |   }
  171 | });
  172 | 
  173 | test("seller payout reserves funds and two admins complete it without duplicate debits", async ({ browser, baseURL }) => {
  174 |   test.setTimeout(150_000);
  175 |   const db = financeDatabase();
  176 |   const contexts: BrowserContext[] = [];
  177 |   try {
  178 |     const f = await createFinanceFixture(db);
  179 |     const seller = await actorPage(browser, baseURL, contexts);
  180 |     await login(seller, f.seller, "/en/seller/finance");
  181 |     await seller.getByPlaceholder(en.seller.manage.pages.finance.amount).fill("60");
  182 |     const pending = seller.waitForResponse((r) => r.url().endsWith("/api/seller/payouts") && r.request().method() === "POST");
  183 |     await seller.getByRole("button", { name: en.seller.manage.pages.finance.request, exact: true }).click();
  184 |     const created = await pending;
  185 |     expect(created.ok(), await created.text()).toBeTruthy();
  186 |     const payout = await db.sellerPayout.findFirstOrThrow({ where: { shopId: f.shop.id } });
  187 |     await expect(seller.getByText(/40\.00/).first()).toBeVisible();
  188 |     const repeated = await seller.request.post("/api/seller/payouts", { data: { amount: 6000 } });
  189 |     expect(repeated.status()).toBe(409);
  190 |     const admin = await actorPage(browser, baseURL, contexts);
  191 |     await login(admin, f.admin, "/en/admin/payouts");
  192 |     const row = admin.getByRole("row").filter({ hasText: payout.id });
  193 |     await row.getByRole("button", { name: en.admin.ui.approve, exact: true }).click();
  194 |     await expect(row.getByRole("button", { name: en.admin.ui.paid, exact: true })).toBeEnabled();
  195 |     const sameAdmin = await admin.request.patch(`/api/admin/payouts/${payout.id}/mark-paid`, { data: { externalReference: "E2E-SAME-ADMIN" } });
  196 |     expect(sameAdmin.status()).toBe(409);
  197 |     await admin.context().close();
  198 |     const completer = await actorPage(browser, baseURL, contexts);
  199 |     await login(completer, f.secondAdmin, "/en/admin/payouts");
  200 |     completer.once("dialog", (dialog) => dialog.accept(`E2E-PAYOUT-${payout.id}`));
  201 |     const paidResponse = completer.waitForResponse((r) => r.url().endsWith(`/payouts/${payout.id}/mark-paid`) && r.request().method() === "PATCH");
  202 |     await completer.getByRole("row").filter({ hasText: payout.id }).getByRole("button", { name: en.admin.ui.paid, exact: true }).click();
  203 |     const paid = await paidResponse;
  204 |     expect(paid.ok(), await paid.text()).toBeTruthy();
  205 |     const duplicate = await completer.request.patch(`/api/admin/payouts/${payout.id}/mark-paid`, { data: { externalReference: `E2E-PAYOUT-${payout.id}` } });
  206 |     expect(duplicate.status()).toBe(409);
  207 |     expect(await db.sellerPayout.count({ where: { shopId: f.shop.id } })).toBe(1);
  208 |     const balance = await db.walletLedgerEntry.aggregate({ where: { walletId: f.wallet.id }, _sum: { amount: true } });
  209 |     expect(balance._sum.amount).toBe(4000n);
  210 |     await seller.reload();
  211 |     await expect(seller.getByText(en.seller.manage.status.paid, { exact: true })).toBeVisible();
  212 |     await expect(seller.getByText(/40\.00/).first()).toBeVisible();
  213 |   } finally {
  214 |     for (const context of contexts) await context.close();
  215 |     await db.$disconnect();
  216 |   }
  217 | });
  218 | 
  219 | 
  220 | 
  221 | test("three partial quantity returns preserve original included tax and cumulative rounding in UI API and DB", async ({ browser, baseURL }, testInfo) => {
  222 |   test.setTimeout(240_000);
  223 |   const db = financeDatabase();
  224 |   const contexts: BrowserContext[] = [];
  225 |   try {
  226 |     const f = await createPartialFinanceFixture(db);
  227 |     const buyer = await actorPage(browser, baseURL, contexts);
  228 |     const seller = await actorPage(browser, baseURL, contexts);
  229 |     const admin = await actorPage(browser, baseURL, contexts);
  230 |     const completer = await actorPage(browser, baseURL, contexts);
  231 |     await login(buyer, f.buyer, `/en/orders/${f.order.id}`);
  232 |     await expect(buyer.getByText(en.checkout.taxIncluded, { exact: true })).toBeVisible();
  233 |     await expect(buyer.getByText(/0\.07/).first()).toBeVisible();
  234 |     const original = await buyer.request.get(`/api/orders/${f.order.id}`);
  235 |     expect(original.ok(), await original.text()).toBeTruthy();
  236 |     expect(await original.json()).toMatchObject({ totals: { grandTotal: "101", taxTotal: "0", includedTaxTotal: "7", reportedTaxTotal: "7" } });
  237 |     await login(seller, f.seller, "/en/seller/returns");
  238 |     await login(admin, f.admin, "/en/admin/refunds");
  239 |     await login(completer, f.secondAdmin, "/en/admin/refunds");
  240 |     for (const [index, cash] of [33n, 33n, 35n].entries()) {
  241 |       await buyer.goto(`/en/orders/${f.order.id}/returns/new`);
  242 |       const quantity = buyer.getByLabel(en.buyer.returnQuantity, { exact: true });
  243 |       await expect(quantity).toHaveAttribute("max", String(3 - index));
  244 |       await quantity.fill("1");
  245 |       const submitted = buyer.waitForResponse((r) => r.url().endsWith("/api/returns") && r.request().method() === "POST");
  246 |       await buyer.getByRole("button", { name: en.buyer.submitRequest, exact: true }).click();
  247 |       const request = await submitted;
  248 |       expect(request.ok(), await request.text()).toBeTruthy();
  249 |       const returned = await request.json();
  250 |       await expect(buyer.getByText(en.buyer.returnSubmitted)).toBeVisible();
  251 |       await seller.reload();
  252 |       const returnRow = seller.getByRole("row").filter({ hasText: f.item.productTitle }).filter({ has: seller.getByRole("button", { name: en.seller.manage.pages.returns.approve, exact: true }) });
> 253 |       await returnRow.getByRole("button", { name: en.seller.manage.pages.returns.approve, exact: true }).click();
      |                                                                                                          ^ Error: locator.click: Error: strict mode violation: getByRole('row').filter({ hasText: 'Finance item 4000' }).filter({ has: getByRole('button', { name: 'Approve', exact: true }) }).getByRole('button', { name: 'Approve', exact: true }) resolved to 2 elements:
  254 |       await expect.poll(() => db.refund.count({ where: { returnRequestId: returned.id } })).toBe(1);
  255 |       const refund = await db.refund.findUniqueOrThrow({ where: { returnRequestId: returned.id } });
  256 |       expect(refund.amount).toBe(cash);
  257 |       await admin.reload();
  258 |       const row = admin.getByRole("row").filter({ hasText: f.order.orderNumber }).filter({ has: admin.getByRole("button", { name: en.admin.refunds.updatePlan, exact: true }) });
  259 |       await expect(row).toContainText(index === 2 ? "0.35" : "0.33");
  260 |       expect((await refundStatus(admin, row, "PROCESSING")).ok()).toBeTruthy();
  261 |       await completer.reload();
  262 |       const completeRow = completer.getByRole("row").filter({ hasText: f.order.orderNumber }).filter({ hasText: en.admin.statuses.PROCESSING });
  263 |       const response = await refundStatus(completer, completeRow, "SUCCESS", `PARTIAL-${refund.id}`);
  264 |       expect(response.ok(), await response.text()).toBeTruthy();
  265 |       expect(await response.json()).toMatchObject({ amount: String(cash), status: "SUCCESS" });
  266 |       expect((await db.returnRequest.findUniqueOrThrow({ where: { id: returned.id } })).status).toBe("COMPLETED");
  267 |     }
  268 |     expect((await db.walletLedgerEntry.aggregate({ where: { walletId: f.wallet.id }, _sum: { amount: true } }))._sum.amount).toBe(0n);
  269 |     expect((await db.refundItemAllocation.aggregate({ where: { itemSale: { orderItemId: f.item.id } }, _sum: { quantity: true, buyerTaxRefund: true } }))._sum).toMatchObject({ quantity: 3, buyerTaxRefund: 7n });
  270 |     await buyer.goto(`/en/orders/${f.order.id}/returns/new`);
  271 |     await expect(buyer.getByText(en.buyer.noItemsEligibleForReturn, { exact: true })).toBeVisible();
  272 |     await seller.goto("/en/seller/finance");
  273 |     await expect(seller.getByText(/0\.00/).first()).toBeVisible();
  274 |     const screenshot = testInfo.outputPath("tax-partial-final-balance.png");
  275 |     await seller.screenshot({ path: screenshot, fullPage: true });
  276 |     await testInfo.attach("tax-partial-final-balance", { path: screenshot, contentType: "image/png" });
  277 |   } finally {
  278 |     for (const context of contexts) await context.close();
  279 |     await db.$disconnect();
  280 |   }
  281 | });
  282 | 
  283 | test("seller finance preserves above-safe lifetime balances, debt and negative satang in UI API and DB", async ({ browser, baseURL }, testInfo) => {
  284 |   test.setTimeout(150_000);
  285 |   const db = financeDatabase();
  286 |   const contexts: BrowserContext[] = [];
  287 |   try {
  288 |     const f = await createFinanceFixture(db);
  289 |     const opening = await db.walletLedgerEntry.findFirstOrThrow({ where: { walletId: f.wallet.id } });
  290 |     await db.walletLedgerEntry.update({ where: { id: opening.id }, data: { amount: 9007199254740993n } });
  291 |     const seller = await actorPage(browser, baseURL, contexts);
  292 |     await login(seller, f.seller, "/en/seller/finance");
  293 |     for (const scenario of [
  294 |       { amount: 9007199254740993n, apiBalance: "9007199254740993", apiDebt: "0", label: /90,071,992,547,409\.93/, evidence: "positive" },
  295 |       { amount: -9007199254740993n, apiBalance: "-9007199254740993", apiDebt: "9007199254740993", label: /-.*90,071,992,547,409\.93/, evidence: "debt" },
  296 |       { amount: -1n, apiBalance: "-1", apiDebt: "1", label: /-.*0\.01/, evidence: "negative-cent" },
  297 |     ]) {
  298 |       await db.walletLedgerEntry.update({ where: { id: opening.id }, data: { amount: scenario.amount } });
  299 |       await seller.reload();
  300 |       await expect(seller.getByText(scenario.label).first()).toBeVisible();
  301 |       const response = await seller.request.get("/api/seller/wallet");
  302 |       expect(response.ok(), await response.text()).toBeTruthy();
  303 |       expect(await response.json()).toMatchObject({ availableBalanceCents: scenario.apiBalance, sellerDebtCents: scenario.apiDebt, currency: "THB" });
  304 |       const entries = await seller.request.get("/api/seller/wallet/transactions?page=1&limit=20");
  305 |       expect(entries.ok(), await entries.text()).toBeTruthy();
  306 |       expect((await entries.json()).items).toEqual([expect.objectContaining({ id: opening.id, amount: scenario.apiBalance })]);
  307 |       expect((await db.walletLedgerEntry.aggregate({ where: { walletId: f.wallet.id }, _sum: { amount: true } }))._sum.amount).toBe(scenario.amount);
  308 |       const screenshot = testInfo.outputPath(`exact-money-finance-${scenario.evidence}.png`);
  309 |       await seller.screenshot({ path: screenshot, fullPage: true });
  310 |       await testInfo.attach(`exact-money-finance-${scenario.evidence}`, { path: screenshot, contentType: "image/png" });
  311 |     }
  312 |   } finally {
  313 |     for (const context of contexts) await context.close();
  314 |     await db.$disconnect();
  315 |   }
  316 | });
  317 | 
```