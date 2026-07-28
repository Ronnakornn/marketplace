# Milestone 26 Task 5 Verification

Date: 2026-07-28

Verified milestone commits:

- `bf797308fe4db147357ea2cf14d2afb775aaf99c` (task 1)
- `b1c98ca626b32a5142b46d267d7243554a4bac06` (task 2)
- `1504452736cffe81d591e21be5dcf92c5bf36b5b` (task 3)
- `c3b0d078644cd95017e87714b45d2952124a57c7` (task 4)

## Automated verification

### Focused checkout, payment, order, and frontend tests

Command:

```text
bunx vitest run app/features/checkout/components/CheckoutPage.test.tsx app/features/payment/api.test.ts app/features/payment/components/MockPaymentPage.test.tsx app/features/buyer/components/PaymentReturnPage.test.tsx server/modules/checkout/checkout.routes.test.ts server/modules/checkout/checkout.service.test.ts server/modules/checkout/checkout.repository.test.ts server/modules/payment/payment.routes.test.ts server/modules/payment/payment.test.ts server/modules/payment/payment.webhook-signature.test.ts server/modules/order/order.service.test.ts
```

Result: PASS — 11 test files passed, 59 tests passed, 0 failed (Vitest 4.1.8; 4.72 seconds).

Covered evidence includes:

- Checkout returns and uses the server-provided localized `paymentUrl` while preserving checkout validation, trusted pricing, reservation input, and transaction rollback behavior.
- The checkout repository converts runtime numeric Prisma prices back to `BigInt` before writing order-item unit and line-total snapshots.
- Mock payment routes require authentication, reject admin misuse and unsupported event types, and resolve buyer-owned payment details.
- Checkout-created `card` payments are accepted by the mock payment detail/event flow, while `cod` remains rejected.
- Payment detail route errors retain their structured `{ error: { code, message, details } }` response and the Eden client extracts that message instead of rendering object strings.
- Mock paid and failed events use trusted server payment facts and the webhook transition path; ownership, idempotency, invalid transitions, reservation release, and order paid/canceled effects are covered.
- Payment webhook signature validation remains covered.
- Buyer order access and shop-grouped order detail behavior remain covered.
- Mock payment UI sends paid/failed events and redirects to payment return; terminal payments disable both mock actions.
- Payment return polls pending/requires-action state, stops on terminal states, renders failed/canceled/refunded distinctly, and stops after the bounded wait window.

### Typecheck

Command: `bunx tsc --noEmit`

Result: PASS — exit code 0, no diagnostics.

### Whitespace/error check

Command: `git diff --check`

Result: PASS — exit code 0, no findings.

## Local dev readiness and browser scenarios

The standard `bun run dev` command was started successfully:

- Next.js 16.2.6 reported ready at `http://localhost:3000`.
- `GET http://localhost:3000/en` returned HTTP 200 (69,549 bytes).
- Elysia reported the API server running on port 3001.
- `GET http://localhost:3001/api/health` returned HTTP 200 with API and database status `ok`.
- Redis was not running locally; the backend repeatedly logged `ECONNREFUSED` for `127.0.0.1:6379` / `::1:6379`. This did not prevent frontend or API/database readiness, but it is an environment limitation for cache-backed behavior.

## Browser-discovered checkout defect and fix

A subsequent Chief browser pass used a fresh local buyer account with a saved address and an in-stock Home Organization Planner cart item. `POST /api/checkout` reached `CheckoutService.createCheckout` and `PrismaCheckoutRepository.createPendingOrder`, then returned `CHECKOUT_FAILED` before payment handoff.

Read-only local diagnostics reproduced the underlying error:

- The global Prisma result extension serializes database `BigInt` values to JavaScript numbers.
- A current active cart item returned both `CartItem.unitPrice` and `ProductVariant.price` with runtime type `number`.
- The checkout repository multiplied that numeric variant price by `BigInt(quantity)`, producing `TypeError: Invalid mix of BigInt and other type in multiplication.`

The narrow fix normalizes `item.variant.price` with `BigInt(...)` once, then uses that value for both the order-item `unitPrice` snapshot and `lineTotal` calculation. A new repository regression test supplies the same runtime numeric price shape and verifies `1200n` unit price plus `2400n` line total for quantity two.

Chief's second browser pass confirmed checkout now succeeds and returns a localized mock payment URL. The checkout-to-payment handoff scenario is PASS.

## Browser-discovered mock payment detail defect and fix

The second browser pass reached `/en/payment/mock/cac7b7ba-e151-4214-86a9-6cf2f4b4977a`, but the page rendered `Unable to load data` and `[object Object]` instead of payment context.

Read-only local diagnostics confirmed the payment exists, is pending, and has the expected buyer-owned detail shape: order number, amount `850`, currency `THB`, and status `PENDING`. Its stored provider is `card`, matching the checkout UI's default payment method. The payment service previously accepted only stored provider `mock`, so GET payment detail returned a structured 400 `INVALID_WEBHOOK_EVENT`. Eden placed that body on the error's `value`, but the frontend returned the Error object before reading `value`, exposing its `[object Object]` message.

The narrow fix:

- treats checkout-created `card` payments as mock-compatible for payment detail and mock event processing;
- continues to reject `cod` and arbitrary providers from the mock flow;
- keeps generated mock events server-owned with provider `mock`;
- extracts nested Eden error messages before falling back to `Payment request failed`, explicitly ignoring `[object Object]` strings.

Regression tests cover the live successful detail response shape, checkout-created `card` compatibility, `cod` rejection, the structured GET error response, nested Eden Error values, and stable fallback copy.

Final manual browser acceptance remains pending for a Chief rerun after this fix. The following scenarios are **not yet claimed as passed end to end**:

- Confirm the mock payment page now renders the returned order/payment context.
- Simulate success and visually confirm payment return plus order detail show succeeded/paid.
- Simulate failure and visually confirm the return page shows failure without an unsupported retry action.
- Open the return page before event processing and visually confirm it remains pending.

The focused automated tests cover both integration defects and each underlying handoff/event/status behavior except the remaining integrated visual journey and cross-page browser consistency.

## Residual risks and follow-up

- A Chief/tester browser rerun is still required for the four scenarios above, beginning with payment context rendering on the mock page; checkout handoff itself has passed.
- Redis should be started or cache disabled for a clean local browser session; its absence produced noisy connection errors during startup.
- Redis unavailability was observed during both local setup and the failing checkout but is unrelated to the reproduced `BigInt` arithmetic defect.
