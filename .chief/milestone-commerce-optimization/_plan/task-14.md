# Task 14: fetch listing filter fallbacks only when needed

Owner: listing fallback builder. Enable category and brand fallback queries independently only when the currently displayed listing lacks the corresponding nonempty facet list. Preserve hook order, pending/empty/error recovery, locale and URL/query identity, pagination and rendered filter semantics. Prove that populated server-seeded facets avoid both fallback requests and that either missing facet still loads its own fallback. Check transitions and visible options with component tests. No schema or API change.
