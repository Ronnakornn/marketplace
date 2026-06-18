# Product Detail SEO Regression

## Goal

Prevent product detail SEO/page guard regressions so public product pages and public product APIs agree on product availability.

## In Scope

- Regression tests for `getPublicProductSeo`, `requirePublicProductSeo`, or the route guard layer.
- Active product with active shop must resolve by id.
- Supported slug lookup must resolve where existing behavior already permits it.
- Missing or inactive product must still produce not-found behavior.

## Out of Scope

- Rewriting SEO strategy.
- Switching canonical URLs to slugs.
- Adding new public product API fields.
- Large test harness refactors.

## Constraints

- Tests must avoid touching generated files.
- Tests must not depend on real production data.
- Keep Prisma access mocked or use existing test patterns in the repo.
