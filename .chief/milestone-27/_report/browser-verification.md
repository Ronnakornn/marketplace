# Milestone 27 Browser Verification — Checkout Quote

Date: 2026-08-01

Verified commit: `3110cd05c1cf7af5af3e735d65631134e1258018` (merge of milestone-27 on
`develop`).

## Environment

- `bun run dev` was already running when this session started (frontend on
  `http://localhost:3000`, backend on `http://localhost:3001`; both confirmed
  with `GET /en` → 200 and `GET /api/health` → 200).
- Database: PostgreSQL (`sming`), reachable; `bunx prisma db push` synced the
  schema cleanly.
- Seed data: `bun run db:seed` (`scripts/seed.ts`) was run to populate demo
  data. This created/updated a buyer account `buyer.demo@example.com` /
  `DemoPass123!` with an active cart, plus coupons `DEMO10` (10% global,
  capped ฿5.00, min order ฿5.00), `FASHION200` (fixed ฿2.00 off, scoped to
  shop `urban-thread-co`, min order ฿10.00), and `EXPIRED5` (inactive).
- Browser: Claude_Browser MCP pane, driven via `navigate` / `read_page` /
  `javascript_tool` / network inspection. **Screenshots could not be
  captured** — every `computer{action:"screenshot"}` / `zoom` call failed
  with `Screenshot timed out after 5s: the Browser pane is not displayed, so
  the page is not compositing frames`, in both the original tab and a freshly
  opened tab. This is an environment limitation of this session, not an
  application defect. All evidence below is DOM text (`get_page_text`,
  `read_page`), console logs, and raw network request/response bodies
  captured instead.
- Login was performed by filling the email/password fields and invoking
  `button.click()` via `javascript_tool` — the `computer{action:"left_click"}`
  click on the "Sign in" button did not trigger form submission (no
  `POST /api/auth/sign-in/email` appeared in network logs after several
  attempts), but a JS-dispatched click did. Noted as a tooling quirk of this
  browser automation session; not evidence of an app bug, since the same
  button also responded to `.click()` normally.

## Buyer session used

- `buyer.demo@example.com`, active cart seeded with variants `SFT-1` and
  `MWPB-1` (FitLab Apparel + Gadget Harbor shops).
- Confirmed logged in via `/en/profile` (showed "Demo Buyer",
  `buyer.demo@example.com`, `USER`, `ACTIVE`, `Email verified`) throughout the
  session.

## Scenario 1 — Total includes shipping

**PASS.**

Opened `/en/checkout` with the seeded cart (FitLab Apparel ฿16.90 + Gadget
Harbor ฿21.80 = ฿38.70 subtotal). Page rendered:

```
FitLab Apparel   ฿16.90
Gadget Harbor    ฿21.80
Shipping         ฿5.00
Total            ฿43.70   (shown twice: summary card + sticky footer)
```

The underlying `POST /api/checkout/quote` response was:

```json
{"subtotal":3870,"discountTotal":0,"shippingTotal":500,"taxTotal":0,"grandTotal":4370,"currency":"THB","coupon":null}
```

`3870 + 500 = 4370` = ฿43.70, matching the displayed total exactly. Shipping
renders as its own row. The original defect (total == subtotal, shipping
invisible) is gone.

## Scenario 2 — Total equals charged total

**PASS.**

With coupon `DEMO10` applied (see Scenario 3), the checkout summary showed
Total = ฿39.83 (both summary and sticky footer). Placing the order returned:

```json
{"orderId":"cb23ba16-c59f-4f57-bd4c-4a0ca6360704","orderNo":"ORD-MSAKO1SX-4438C9B5","paymentId":"2ad5c3ba-b968-4520-b645-5283c4b607b7","paymentStatus":"pending","paymentUrl":"/en/payment/mock/2ad5c3ba-b968-4520-b645-5283c4b607b7","totalCents":3983}
```

`totalCents: 3983` = ฿39.83, exactly matching the displayed total. The mock
payment page (`/en/payment/mock/2ad5c3ba-...`) independently confirmed:

```
Order      ORD-MSAKO1SX-4438C9B5
Amount     THB 39.83
Payment status  PENDING
```

Displayed total, checkout response `totalCents`, and the payment page amount
all agree.

Note: I could not additionally cross-check the buyer order-detail page
(`/en/orders`) for this order — navigating to `/en/orders` or
`/en/orders/<id>` via a full browser navigation rendered a signed-out
"Sign in / Sign up" header even though the session was still valid (confirmed
by immediately reloading `/en/profile`, which stayed signed in), and clicking
the "My orders" link from the Profile page did not navigate. This looks like
a pre-existing SSR/session-hydration quirk of the orders route, unrelated to
the checkout-quote feature (the contract and goal docs for milestone-27 do
not touch the orders module). I'm flagging it rather than silently omitting
it, but I did not investigate further since it's out of scope and the
payment-page cross-check already gives a second independent source of truth
for the charged amount.

## Scenario 3 — Valid coupon

**PASS**, using `DEMO10` (global, active, 10%, capped ฿5.00, min order
฿5.00 — the seed's `FASHION200` is scoped to the `urban-thread-co` shop and
was not tested since the seeded cart's items did not clearly belong to that
shop).

Typed `DEMO10`, pressed Apply. UI updated to:

```
Coupon applied: DEMO10   [Remove]
...
Discount   -฿3.87
Shipping   ฿5.00
Total      ฿39.83
```

Quote response:

```json
{"subtotal":3870,"discountTotal":387,"shippingTotal":500,"taxTotal":0,"grandTotal":3983,"currency":"THB","coupon":{"code":"DEMO10","applied":true}}
```

`3870 - 387 + 500 = 3983` = ฿39.83. Discount row appeared only once a
non-zero discount existed (absent when `coupon: null`/`discountTotal: 0` in
Scenario 1). The charged total (Scenario 2, same coupon) matched exactly.

## Scenario 4 — Invalid coupon

**PASS.**

Typed `NOPE12345`, pressed Apply. The screen did not error out or blank; it
stayed fully usable and showed:

```
Coupon applied: NOPE12345   [Remove]
This coupon code doesn't exist.
...
Total   ฿43.70   (unchanged from Scenario 1, no discount applied)
```

Quote response:

```json
{"subtotal":3870,"discountTotal":0,"shippingTotal":500,"taxTotal":0,"grandTotal":4370,"currency":"THB","coupon":{"code":"NOPE12345","applied":false,"reason":"COUPON_NOT_FOUND"}}
```

`Place order` button remained enabled (`disabled: false`, checked via
`button.disabled` in the DOM). No full-page error state was shown; the
message rendered inline next to the coupon control. One minor UX/copy
observation: the label above the failure message still reads "Coupon
applied: NOPE12345" even though the coupon was not actually applied — the
message below it ("This coupon code doesn't exist.") does communicate the
failure, so this is not a functional defect, but the "applied" wording is
arguably misleading copy. Flagging for chief-agent's judgment, not blocking.

## Scenario 5 — Typed-but-not-applied coupon

**PASS.**

Sequence: applied `DEMO10` (Total ฿39.83) → typed `FASHION200` into the
coupon input **without** pressing Apply → immediately clicked "Place order".

- Before placing the order, the displayed total was still ฿39.83 (DEMO10's
  amount) — typing alone did not change the summary.
- The `POST /api/checkout` response was `totalCents: 3983`, i.e. exactly the
  `DEMO10`-discounted amount, not a `FASHION200`-discounted (or any other)
  amount.
- The resulting order/payment page showed `THB 39.83`, consistent with
  `DEMO10` having been the coupon actually used.

This confirms the applied code (not the typed-but-unapplied code) is what
reaches order creation, matching the task-3/contract requirement.

## Scenario 6 — Commit guard

**Partially verified — code-reviewed PASS, but the transient loading/error
states could not be empirically captured live.**

I could not reliably observe the sub-second "quote loading" window or force
a quote-fetch failure in this browser session: this tool has no
devtools-network-throttling equivalent, and JS injected via
`javascript_tool` to poll button state across a full page navigation is
wiped because each `navigate()` call is a real page load that resets the
JS context. Repeated attempts to catch the button mid-load landed after the
(locally very fast) quote request had already resolved.

What I did confirm directly:
- After the quote resolves successfully, `Place order` is enabled
  (`button.disabled === false`), in both the "no coupon" and "coupon
  applied"/"coupon rejected" states.
- No stale/wrong amount ever appeared during any of the above interactions —
  every total shown matched its corresponding quote response exactly; I saw
  no flash of `cart.subtotal`-only totals (e.g. ฿38.70 without shipping)
  during coupon apply/remove cycles.

I additionally read `app/features/checkout/components/CheckoutPage.tsx`
(read-only, for verification, not modified) to confirm the guard is wired
the way the contract describes:

```
const canPlaceOrder = Boolean(addressId) && quoteQuery.isSuccess && !quoteQuery.isLoading;
...
disabled={checkoutMutation.isPending || !canPlaceOrder}
```

and `renderQuoteTotal()` returns a `Skeleton` while `quoteQuery.isLoading`,
an inline error-with-retry while `quoteQuery.isError`, and otherwise renders
`quoteQuery.data.grandTotal` — there is no code path that falls back to
`cart.subtotal`. This structurally satisfies "disabled while loading,
erroring, or absent" and "no stale/wrong amount", but I want to be explicit
that the loading/error branches were confirmed by reading the code, not by
watching them happen live in the browser. Recommend either a targeted
throttled-network browser pass (e.g. via a CDP-capable tool) or trusting the
existing `CheckoutPage.test.tsx` guard tests (task-4, builder-owned) as the
empirical backstop for this scenario.

## Scenario 7 — Both locales

**PASS** for the strings exercised in this session.

`/en/checkout`: `Shipping`, `Total`, `Coupon`, `Apply`, `Place order`, coupon
apply/remove copy, and the invalid-coupon reason ("This coupon code doesn't
exist.") all rendered in English with no raw keys.

`/th/checkout`: the same summary rendered fully in Thai:

```
สรุป
Gadget Harbor   ฿21.80
ค่าจัดส่ง        ฿5.00
ยอดรวม           ฿26.80
                 ฿26.80
สั่งซื้อ
```

and, with the same invalid coupon applied:

```
ใช้คูปองแล้ว: NOPE12345   ยกเลิกคูปอง
ไม่พบรหัสคูปองนี้
```

No literal i18n keys (e.g. `checkout.shipping`) appeared on screen in either
locale for any string I exercised. I did not exhaustively click every
possible coupon-rejection reason (only `COUPON_NOT_FOUND`); the other five
reason keys (`checkout.couponReasonInvalid`, `...Inactive`, `...NotStarted`,
`...Expired`, `...MinOrderNotMet`, `...UsageLimitReached`,
`...UserLimitReached`) exist in the component's `COUPON_REASON_KEYS` map but
were not individually triggered/observed — I did not have seed data on hand
to cheaply trigger each one (e.g. a not-yet-started coupon), so I did not
claim to verify their translations.

## Scenario 8 — Console

**PASS** for what I observed.

- On initial `/en/checkout` load (post-login), console showed no errors —
  only HMR/dev-server logs and the standard React DevTools info message.
- On a hard reload (`location.reload()`) of `/th/checkout`, same result — no
  hydration warnings, no errors, only HMR/Fast-Refresh logs.
- Checked again after each coupon apply/remove interaction in both locales —
  no new console errors appeared.
- I did not see any React error about `<div>` inside `<p>`. Reading the
  current source, the total row is a `<div className="flex justify-between
  text-lg font-bold">` wrapping a `<span>` and the skeleton/amount/error
  node — not a `<p>` — consistent with the fix having stuck.

## Summary

| # | Scenario | Result |
|---|----------|--------|
| 1 | Total includes shipping | PASS |
| 2 | Total equals charged total | PASS (order-detail cross-check blocked by an unrelated orders-page session issue; payment-page cross-check succeeded) |
| 3 | Valid coupon | PASS (DEMO10; FASHION200 not exercised — shop-scoped, not clearly applicable to seeded cart) |
| 4 | Invalid coupon | PASS |
| 5 | Typed-but-not-applied coupon | PASS |
| 6 | Commit guard | Enabled/no-stale-amount states verified live; loading/error-disable states verified by code reading only, not live observation |
| 7 | Both locales | PASS for strings exercised; not all six coupon-rejection reason keys were individually triggered |
| 8 | Console | PASS — no hydration warnings or errors observed |

## Things I could NOT verify, stated plainly

- No screenshots were captured — the browser pane in this session never
  entered a compositing state, so every screenshot/zoom call timed out. All
  visual evidence above is DOM text and network payloads instead.
- The buyer order-detail page could not be reached in this session (see
  Scenario 2) to do a third-way cross-check of the charged amount; I relied
  on the checkout API response and the mock payment page instead, which
  agreed with each other and with the UI.
- The quote-loading and quote-error disabled-button states were not observed
  live (see Scenario 6) — confirmed by source reading only.
- `FASHION200` (shop-scoped coupon) and five of the seven coupon-rejection
  reason translations were not exercised.
- I did not run `bunx tsc --noEmit` / `bun run test` — those are
  builder-agent's deterministic verification responsibility, not mine.
