# task-7: Optimize buyer entry render and hydration path where measured

## Summary

Optimized the measured `/th` buyer home render bottleneck by removing the `MarketplaceHome` mount gate that returned an empty `min-h-screen` placeholder until client hydration.

The existing marketplace home content, fallback product feed, category grid, vouchers, sticky CTA, and buyer links now render on the initial React render instead of waiting for `useEffect`. This preserves the current UX and public locale-aware links while reducing the blank initial body identified in the task-5 baseline.

## Changes

- Removed the `mounted` state and empty pre-hydration placeholder from `MarketplaceHome`.
- Kept the existing React Query data path and public API behavior unchanged.
- Kept `/th/search` behavior unchanged because task-5 and task-6 showed its dominant frontend behavior is client data rendering without a blank mount gate, while backend search caching was already addressed in task-6.
- Added a focused smoke test proving marketplace hero and fallback product content are present on initial render before query hydration completes.

## Public/Private Boundary

No cache behavior was changed. No private auth, cart, checkout, order, payment, seller, or admin data was cached or exposed.

## Verification

- `bun run test app/features/marketplace/components/MarketplaceHome.test.tsx` passed.
- `bunx tsc --noEmit` passed.

## Notes

- The focused test mocks UI primitives to avoid the repository's existing Vitest alias gap for `@/lib/utils` inside shadcn UI modules.
- No browser/manual external acceptance testing was performed.
