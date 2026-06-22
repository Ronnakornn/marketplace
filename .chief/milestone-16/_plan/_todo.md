# Milestone 16 TODO: Buyer Home Commerce Completeness

- [x] task-1: Complete home composition, responsive layout, and resilient states
  - Align hero, voucher strip, categories, featured shops, sticky CTA, and mobile bottom navigation with `home-composition-ui.md`.
  - Add or refine loading, empty, error, and retry states without layout jumps or text overlap.

- [x] task-2: Normalize home product rail data for reusable buyer ProductCard
  - Adapt Recommended, New Arrivals, and Recently Viewed rails to render through the reusable buyer `ProductCard` where data supports it.
  - Extend discovery/recommendation DTOs only if required for safe card behavior, following `home-product-card-data.md`.

- [x] task-3: Align home buyer action handoff
  - Ensure quick-add, favorite, login handoff, cart invalidation/refetch, and readable errors match listing/detail behavior.
  - Prevent favorite/add-to-cart controls from triggering unintended product navigation.

- [x] task-4: Finish Flash Sale commerce behavior
  - Keep Flash Sale custom while preserving sale urgency, progress, sale/original price treatment, and stable card sizing.
  - Route to product detail instead of guessing when Flash Sale data is insufficient for safe add-to-cart.

- [x] task-5: Verify home UX/UI with tests and browser evidence
  - Add/update focused tests for home states, rails, product-card integration, and buyer action handoff.
  - Run typecheck/tests and save desktop, mobile, and logged-in buyer quick-add evidence under `.chief/milestone-16/_report/`.
