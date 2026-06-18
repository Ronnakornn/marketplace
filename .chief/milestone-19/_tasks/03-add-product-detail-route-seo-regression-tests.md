# Task 03: Add Product Detail Route/SEO Regression Tests

## Objective

Add focused regression tests that prevent the product detail route/SEO guard from drifting away from public product API visibility.

## Scope

- Test active product with active shop resolving by product id.
- Test supported slug lookup behavior where existing code supports slug resolution.
- Test missing or unavailable product not-found behavior.
- Use existing test patterns for Prisma mocking or isolated data.

## Likely Files

- `app/lib/seo.test.ts`
- Nearby route/page guard tests if they already exist.
- Test fixtures/helpers only if existing patterns require them.

## Constraints

- Do not depend on production data.
- Do not manually edit generated files.
- Keep tests focused on route/SEO visibility behavior, not product detail UI layout.

## Verification

- Focused tests pass locally.
- Failures clearly identify route/SEO visibility regressions.
