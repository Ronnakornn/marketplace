# Home Verification Contract

## Purpose

The completed buyer home milestone must be verified with focused automated tests and browser evidence.

## Automated Verification

- Run typecheck with `bunx tsc --noEmit`.
- Run focused tests covering marketplace home behavior and product-card integration.
- Run the broader test command if focused tests pass and runtime cost is acceptable.
- Add or update tests for home loading, empty, error/retry, product rail rendering, and buyer action handoff.

## Browser Evidence

- Capture desktop home overview evidence.
- Capture mobile home overview evidence.
- Capture logged-in buyer quick-add success evidence.
- Capture empty, error, or loading state evidence where practical.
- Save evidence or notes under `.chief/milestone-16/_report/`.

## Acceptance Checks

- No overlapping text or controls in hero, category grid, product rails, Flash Sale cards, sticky CTA, toast/confirmation, or mobile bottom nav.
- Quick-add success updates cart-related UI or state after invalidation/refetch.
- Guest action handoff is understandable.
- Local development warnings that do not block acceptance must be documented in the report.

## Boundaries

- Cross-browser certification and production CDN validation are not required.
- Load testing is not required.
