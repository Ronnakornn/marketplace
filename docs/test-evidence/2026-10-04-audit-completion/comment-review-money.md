# Comment review: completed money slice

Read-only review at HEAD `26507c21277695049da22046e42c3090491f9c07`, compared with `9cb0fa3`; also inspected the 14 uncommitted app/e2e money-integration files. Read the no-comments skill in full. Source touched: **none**. Actual deletions: **0**. No tests, browser runs, database writes, or commits were performed for this review.

## Strict diff result

**1 deletion candidate, 1 line:** `e2e/finance-lifecycle.spec.ts:227`, the lifetime-ledger precondition narration. The immediately following fixture lookup and explicit `9007199254740993n` ledger update already state it. Delete the comment only; retain the independent literal browser expectations and bigint setup.

**1 newly added keep:** `app/features/cart/components/CartPage.money.test.tsx:1`, `@vitest-environment jsdom`. This is a runner directive consumed by Vitest, not narration. [Vitest documents the exact per-file control-comment mechanism](https://vitest.dev/guide/environment.html#environments-for-specific-files). The repository config has no global browser environment; this file calls React Testing Library DOM rendering. The saved integrated app report records this test passing.

No new correctness/safety suppression and **no strict-diff MUST KILL** was found. The other comments below predate `9cb0fa3`; they are context findings, not additional authorized deletions under a strict diff fence.

## Pre-existing context findings in the changed files

Total including the strict candidate: **38 line-comment deletion candidates** across **17 files**. Therefore **37 lines** below require an explicitly broader changed-file cleanup interpretation. Line references use the inspected HEAD source or current app/e2e files; identical HEAD/working comments are counted once.

| File | Lines | Exact symbol | Grounded disposition |
| --- | --- | --- | --- |
| `app/features/checkout/components/CheckoutPage.tsx` | 117, 118 | `handlePlaceOrder` | Delete comment only: The synchronous ref claim is already visible in the handler. |
| `app/features/marketplace/components/MarketplaceHome.tsx` | 451 | `ProductVisual` | Delete comment only: The performance-rule waiver has no demonstrated faulty/style-only or external-constraint exception. |
| `server/modules/cache/cache.service.ts` | 82 | `CacheService.remember` | Delete comment only: The captured invalidation version and equality guard express this behavior. |
| `server/modules/cart/cart-concurrency.integration.test.ts` | 36, 37 | `initialReads / synchronized` | Delete comment only: Barrier setup narrates the adjacent test code. |
| `server/modules/cart/cart.repository.ts` | 161, 162 | `PrismaCartRepository.findOrCreateActiveCart` | Delete comment only: Lock plus post-lock lookup already express serialization. |
| `server/modules/cart/cart.service.ts` | 114 | `CartService.addItem` | Delete comment only: The void call already expresses the non-awaited analytics operation. |
| `server/modules/catalog/catalog-cache.integration.test.ts` | 48, 67 | `catalog cache integration test` | Delete comment only: Cache-presence and suspended-shop assertions express both claims. |
| `server/modules/catalog/catalog.repository.ts` | 854, 874, 875 | `PrismaCatalogRepository.findProducts` | Delete comment only: The first comment admits an owned scalability limitation; the other two narrate Promise.all. |
| `server/modules/catalog/catalog.service.test.ts` | 133, 134 | `createProduct` | Delete comment only: Completed field-edit instructions are stale narration. |
| `server/modules/catalog/catalog.service.ts` | 293, 294, 585, 586, 587, 607, 1049, 1397, 1398 | `getPublicProductMetrics / getPublicProductDetail / resolvePublicProductId / createVariant / loadProductFacets` | Delete comment only: Promise maps, canonical key, visibility lookup, property assignment, and list key express these claims. |
| `server/modules/payment/payment.test.ts` | 509, 510, 511 | `payment-status cancel-causes test` | Delete comment only: The test title and paired event assertions express the contract. |
| `server/modules/wallet/settlement-policy.integration.test.ts` | 148 | `stale-eligibility integration test` | Delete comment only: The deliberately changed order and zero-balance assertions express the scenario. |
| `app/features/checkout/components/CheckoutPage.test.tsx` | 336, 337, 338 | `quote-failure total test` | Delete comment only: The title and literal unequal shop totals express the test distinction. |
| `e2e/commerce-edge-flows.spec.ts` | 145 | `test.beforeEach / isolateActorPage` | Delete comment only: Narrates the test setup and our rate-limit implementation. |
| `e2e/finance-lifecycle.spec.ts` | 48, 72 | `finance refund scenario / context teardown` | Delete comment only: The arithmetic comment narrates a literal; the WebKit stall claim has no linked issue or scoped failure evidence. |
| `e2e/finance-lifecycle.spec.ts` | 227 | `exact-lifetime finance test opening ledger setup` | Delete comment only: The fixture and subsequent explicit bigint ledger update express the precondition. |
| `e2e/helpers/commerce-fixtures.ts` | 50 | `prepareCart` | Delete comment only: Narrates fixture setup and test-suite organization. |
| `server/modules/search/search.service.test.ts` | 116 | `search product fixture` | Delete comment only: BigInt call already expresses conversion. |

**Context MUST KILL:** `PrismaCatalogRepository.findProducts` price-sort branch (`server/modules/catalog/catalog.repository.ts:853`): it loads every matching product before sorting and slicing, and the ponytail comment defers this owned limitation. If that context finding is accepted, sketch bounded database price ordering/pagination; do not relabel the prose as an external dependency exception. This is outside the strict added-comment result. No application refactor was made or authorized by this report.

The image suppression is a **context deletion candidate, not a correctness/safety MUST KILL**. [Next.js defines `@next/next/no-img-element` as an image-performance rule](https://nextjs.org/docs/messages/no-img-element), with supported Image/custom-loader alternatives. Nearby `ProductVisual` shows a lazy raw image, but proves no unavoidable external constraint or faulty/pedantic/style-only rule. An image migration would need its own scoped review; removing this comment does not itself improve image performance.

The serial WebKit teardown is retained as intentional test code. The comment's host-stall explanation was not established by a scoped failure artifact or vendor issue; no browser was launched to invent proof. Deleting that unsupported prose does not justify changing teardown concurrency.

## Other keeps and skips

Keep the pre-existing `@vitest-environment jsdom` directives at line 1 in `GuestAddToCartButton.test.tsx`, `ProductCard.test.tsx`, `SellerManagePages.test.tsx`, `tracking.test.ts`, `AdminSettlementRefundActions.test.tsx`, `CheckoutPage.test.tsx`, `MockPaymentPage.test.tsx`, and `SellerPromotionsPage.numeric.test.tsx`; these specify the external runner environment. Keep `server/modules/payment/payment.repository.ts:61`: it defines the exported `IPaymentTransactionRepository.applyPaymentStateTransition` API obligation to synchronize Payment and Order payment states.

Excluded active W7 source: checkout, Prisma schema/migrations, refund, Return, admin economics, and uncommitted wallet/affiliate economics changes. Committed source was read with `git show HEAD:<path>` to avoid attributing active W7 edits to completed work. Generated code, dependencies, documentation prose, and unchanged config files were not cleanup targets. The current vitest.config.ts timing comments were read for directive context only and are outside this slice.

Census: 142 changed app/server/scripts TS/TSX files after the domain exclusions, plus the 14 current money-integration app/e2e files. Parsed comment ranges and manual inline/JSX checks were compared with zero-context added-line diffs. No scoped `@ts-ignore` or `@ts-expect-error` was found; the existing no-img directive above was the only scoped eslint suppression. URLs, glob strings, and template-literal URLs were not classified as comments. Most narration discovered in whole changed files already exists in the baseline; counts above deliberately separate it from the strict diff result.
