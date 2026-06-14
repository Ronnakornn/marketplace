# Milestone 9 TODO: Product Detail Buyer Conversion UX

- [x] task-1: Clarify product detail variant option states
  - Improve selected, available, unavailable, and out-of-stock option presentation on the buyer product detail page.
  - Keep disabled option values non-selectable.
  - Fix corrupted product detail display text related to variant/rating separators.

- [x] task-2: Improve quantity, stock, and disabled action feedback
  - Constrain quantity against selected variant stock.
  - Clamp or reset quantity when variant selection changes.
  - Show buyer-readable disabled reasons before add-to-cart or buy-now can run.
  - Preserve existing cart mutation and buy-now behavior.

- [x] task-3: Add sticky purchase summary for product detail
  - Show selected price or price range, selected variant prompt/label, quantity, and stock/disabled reason in the sticky action area.
  - Keep mobile and desktop layouts readable without overlapping product content.
  - Preserve existing add-to-cart and buy-now entry points.

- [x] task-4: Polish product media, facts, tests, and verification report
  - Improve product media and key facts/specification scanability using existing product data.
  - Add or update focused product detail tests for variant state, disabled reasons, quantity behavior, sticky summary, and existing cart/buy-now behavior.
  - Run required verification commands and write the final report under `.chief/milestone-9/_report/`.
