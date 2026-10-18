# Commerce optimization

- [x] task-1: reduce cart hydration while preserving mutation isolation and responses.
- [x] task-2: batch checkout Flash Sale reads while retaining locked commitment validation.
- [x] task-3: share search/catalog facet caches across pagination and sorting.
- [x] task-4: server-seed search/category first pages with matching query inputs.
- [x] verification: focused tests, typecheck, full tests, build, independent review and runtime checks.

No schema changes. Preserve exact money, ownership, stock reservation, URL filters, locale and cache invalidation contracts. Root owns integration and documentation. Each implementation owner runs focused tests and reports any contract deviation before expanding scope.

Evidence and the blocked live-browser limitation are recorded in ../_report/verification.md.

- [x] follow-up optimization loop: tasks 5–14, repeated inspection, independent review and final verification. See optimization-loop.md and ../_report/optimization-loop.md.
