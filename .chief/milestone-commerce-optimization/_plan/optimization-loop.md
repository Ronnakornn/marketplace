# Optimization loop

## Predicate

Finish tracking batches, compact public catalog cards, scoped translation payloads and the product-detail/rating request path. Preserve ownership, exact money, stock, pagination, translation fallback and SEO. Keep a change only when behavior checks pass and request/query counts or serialized payload demonstrate removal of work. Reinspect affected public paths and fix any further concrete duplication found. Do not claim latency gains without a controlled comparison.

## Workflow

- [x] Read the Principles section of poteto-mode.
- [x] Phase A: Frame. Four scoped units, no planned schema change; existing uncommitted first-round changes remain intact.
- [x] Phase B: Design the workflow. Compare two sketches and capture a baseline before implementation.
- [x] Phase C: Run the loop. Implement and verify each bounded unit.
- [x] Phase D: Keep the audit trail. Record accepted, corrected and rejected attempts.
- [x] Phase E: Verify and hand back. Independent review, typecheck, full tests, production build and actual API/database checks.

## Units

- [x] task-5: bounded impression batching with unchanged single-event behavior and metadata.
- [x] task-6: compact public catalog/related projections retaining quick-add behavior.
- [x] task-7: scoped translation messages retaining fallback and client navigation.
- [x] task-8: one product-detail boot request including best-effort rating summary and canonical identity.
- [x] task-9: related-product requests match four displayed cards. Preserve recently-viewed overfetch until its duplicate-history window is redesigned and measured.
- [x] task-10: reviewer found case-insensitive UUID lookup regression in tracking batch; canonicalize identities without dropping event facts.
- [x] task-11: narrow unused cart scalar data with unchanged CartService outputs.
- [x] task-12: check Flash Sale promotion admission once per candidate shop set.
- [x] task-13: reuse a loaded coupon within a validation round, retaining fresh post-lock validation.
- [x] task-14: avoid category/brand fallback reads when displayed listing facets already supply their options.
- [x] Reinspect and fix additional evidence-backed public-path waste; verify each accepted change.

throughput checkpoint: independent tracking, catalog/review and translation ownership; root coordinates contracts and verification. No new external messages, deployment or merge. Tables remain Product, ProductVariant, Inventory, ProductImage, ProductViewLog, Review and existing catalog relations. No migration expected.

Automatic approval previously rejected Next dev startup. Do not retry that action through another command. Verify built output, component HTML and actual API/database behavior; retain the browser limitation unless an already authorized live surface becomes available.
