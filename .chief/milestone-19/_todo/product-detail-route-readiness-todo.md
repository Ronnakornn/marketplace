# Product Detail Route Readiness TODO

## Tasks

1. Diagnose product detail route and public API visibility mismatch.
   - Compare the public product API query with `getPublicProductSeo` and the product detail page guard.
   - Verify the seeded product route state through same-origin frontend `/api/products` and direct product detail route.
   - Record the mismatch cause in `.chief/milestone-19/_report/`.

2. Align product detail route SEO lookup with public product visibility.
   - Update the smallest route/SEO/query surface needed for active products from active shops to resolve.
   - Preserve not-found behavior for missing, inactive, suspended, deleted, or private products.
   - Preserve canonical metadata path as `/products/<product.id>` unless a narrow verified fix requires otherwise.

3. Add product detail route/SEO regression tests.
   - Cover active product with active shop resolving by id.
   - Cover existing supported slug lookup behavior where applicable.
   - Cover missing or unavailable product not-found behavior.
   - Keep tests isolated from real production data.

4. Verify automated quality gates.
   - Run focused regression tests.
   - Run `bunx tsc --noEmit`.
   - Run `bun run test`.

5. Capture browser evidence.
   - Start required local dev services.
   - Capture desktop, mobile, and logged-in buyer product detail screenshots.
   - Save evidence and notes under `.chief/milestone-19/_report/`.
   - Stop local dev services started for verification.

## Done Criteria

- A seeded active product returned by `/api/products` renders on the buyer product detail page.
- Product detail 404 behavior remains correct for unavailable products.
- Regression tests, typecheck, and full test suite pass or blockers are documented.
- Browser evidence exists under `.chief/milestone-19/_report/`.
