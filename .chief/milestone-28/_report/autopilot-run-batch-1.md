# Autopilot Run Batch 1

## Mode

auto

## Summary

Completed Milestone 28 public storefront implementation and focused
verification across localized data, public identity, catalog navigation,
reviews, policies, buyer actions, analytics, and responsive browser behavior.

## Tasks Completed

- task-1: Added nullable Thai/English storefront content, seller editing,
  ownership checks, normalization, and fallback behavior.
- task-2: Added the safe UUID-or-slug public storefront read model, adaptive
  identity UI, real metrics, owner mode, and localized SEO.
- task-3: Added repository-backed catalog sorting/filtering/pagination, shared
  product cards, buyer header, and mobile navigation.
- task-4: Added paginated published reviews, localized policies, follow/chat
  flows, and bounded non-blocking storefront analytics.
- task-5: Stabilized unit/E2E fixtures, added six deterministic storefront
  Playwright scenarios, captured responsive evidence, and documented residual
  repository-wide E2E risk.

## Decisions Made

- **Issue:** Shop event persistence could use unbounded metadata or an explicit
  discriminator.
  **Options:** Metadata event strings; Prisma enum and field.
  **Chosen:** `ShopViewEventType` enum with a safe default.
  **Reason:** Bounded data and simpler analytics queries without private data.
- **Issue:** Parallel component tests timed out under default worker count.
  **Options:** Raise all timeouts; reduce worker pressure and split one oversized
  test.
  **Chosen:** Split the test and cap workers at four.
  **Reason:** Removes measured contention without hiding slow failures.
- **Issue:** Playwright server lifecycle hung on Windows.
  **Options:** Manual process killing; own API/frontend servers independently
  and disconnect fixture Prisma.
  **Chosen:** Independent web servers and explicit fixture teardown.
  **Reason:** Focused storefront runs now pass repeatedly and leave no listeners.
- **Issue:** Legacy seller E2E suites remain unstable and outside storefront
  paths.
  **Options:** Expand Milestone 28 into seller E2E repair; document as residual
  repository risk.
  **Chosen:** Document precise failures and retain focused M28 acceptance.
  **Reason:** Failures predate M28 and do not exercise storefront code.

## Backlog

- Repair the legacy seller Product Studio, inventory, orders/returns, and Thai
  mobile E2E scenarios so the repository-wide `test:e2e` gate is green.
- Investigate the verifier watchdog anomaly where all six storefront tests pass
  and ports close but its outer wrapper does not return before the deadline.

## User Action Needed

- None for Milestone 28 storefront scope.
