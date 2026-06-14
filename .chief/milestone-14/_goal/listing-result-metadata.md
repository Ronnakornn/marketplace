# Listing Result Metadata

## Goal

Add API-backed listing metadata so buyer listing/search pages can communicate result totals and pagination state accurately.

## In Scope

- Result metadata such as `totalCount`, `page`, `pageSize`, `hasNextPage`, and applied query summary.
- Metadata normalization in frontend product queries.
- UI copy that distinguishes initial loading, loaded result count, empty results, and filtered results.
- Tests that prove listing UI does not infer unavailable metadata incorrectly.

## Out of Scope

- Cursor-based pagination unless the existing API already supports it cleanly.
- Search ranking algorithm changes.
- Personalized result ordering.

## Constraints

- Metadata must come from backend/catalog/search APIs, not client-side guesses.
- API responses must remain backward-compatible where practical.
- Pagination must never request unbounded product lists.
