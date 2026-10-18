# Task 3: facet caching

Owner: root. Scope: search/catalog service facet loaders and focused tests.

Keep existing search/product invalidation namespaces. Cache facets with a distinct view and only the filters their repository query uses. Drop page/limit/cursor/sort from facet keys while retaining actual predicates. Failures remain nonfatal and must not poison the facet cache. Verify reuse across page/sort, isolation for changed semantic filters, invalidation and bigint parity.
