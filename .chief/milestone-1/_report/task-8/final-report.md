# task-8: Verify buyer entry improvements and clean diagnostics

Measured locally on 2026-05-25 against development servers:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Routes: `/th` and `/th/search?q=phone`
- Final warm measurement reused an already-running local dev server to match the task-5 baseline setup.

## HTTP Timing Comparison

| Request | Baseline total | Final total | Change |
| --- | ---: | ---: | ---: |
| `GET /th` cold | 201.95 ms | 82.77 ms | -59.0% |
| `GET /th` warm | 187.72 ms | 81.10 ms | -56.8% |
| `GET /th/search?q=phone` cold | 317.50 ms | 600.04 ms | +89.0% |
| `GET /th/search?q=phone` warm | 274.61 ms | 83.68 ms | -69.5% |
| `GET /api/products?limit=50&locale=th` cold | 19.70 ms | 225.70 ms | +1045.7% |
| `GET /api/products?limit=50&locale=th` warm | 15.88 ms | 17.65 ms | +11.1% |
| `GET /api/categories?locale=th` | 3.42 ms | 8.28 ms | +142.1% |
| `GET /api/coupons?locale=th` | 98.99 ms | 8.19 ms | -91.7% |
| `GET /api/search/products?q=phone&sort=newest&limit=40&locale=th` cold | 215.64 ms | 57.12 ms | -73.5% |
| `GET /api/search/products?q=phone&sort=newest&limit=40&locale=th` warm | 3.02 ms | 19.11 ms | +532.8% |
| `GET /api/search/suggestions?q=phone&limit=8&locale=th` | 44.29 ms | 20.95 ms | -52.7% |
| `GET /api/categories?locale=th` for search | 3.99 ms | 2.40 ms | -39.8% |

Raw final results are in `measurement.json`.

## Browser Visible Render Evidence

| Page | Baseline elapsed | Final elapsed | Baseline DOM | Final DOM | Observation |
| --- | ---: | ---: | ---: | ---: | --- |
| `/th` | 3,211 ms | 1,122 ms | 60,458 B | 135,162 B | DOM dump includes marketplace, hero, and product-card markers on first render. |
| `/th/search?q=phone` | 4,265 ms | 1,161 ms | 93,155 B | 101,798 B | DOM dump includes search/result markers. |

Saved browser evidence:

- `browser-home-dom.html`
- `browser-search-dom.html`
- `browser-home.err.log`
- `browser-search.err.log`

Both final browser stderr logs were empty.

## Public/Private Cache Boundary

Verified as far as focused tests cover:

- Public cache key coverage includes products, categories, product detail, search products, search suggestions, and seller dashboard.
- Search suggestion cache varies by behavior-changing inputs covered in tests: query, limit, and locale.
- Product/search invalidation clears suggestion cache entries.
- Focused cache tests assert no supported key builder caches cart, checkout, or payment data.
- No auth/session, order, seller private resource, or admin data was added to buyer public cache paths in this task.

## Diagnostics Cleanup

- Temporary measurement script and outputs are isolated under `.chief/milestone-1/_report/task-8/`.
- A production-path search for task diagnostics (`buyer-baseline`, `buyer-final`, `measure-buyer`, `performance measurement`, `dump-dom`, `console.log`) under `app/` and `server/` returned no matches.
- No production app/server files were modified for task-8.

## Commands Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .chief/milestone-1/_report/task-8/measure-buyer-final.ps1
bun run test server/modules/cache/cache.service.test.ts server/modules/search/search.service.test.ts app/features/marketplace/components/MarketplaceHome.test.tsx
bunx tsc --noEmit
rg -n "buyer-baseline|buyer-final|measure-buyer|performance measurement|dump-dom|console\.log" app server --glob '!**/*.test.*'
```

## Result

Verification passed. `/th` HTTP totals and browser DOM elapsed improved substantially. `/th/search` warm route and browser DOM elapsed improved substantially. Search suggestions improved from 44.29 ms to 20.95 ms. Some cold/API timings varied in local development mode; the warm and browser-visible evidence confirms the buyer entry improvements targeted by tasks 6 and 7.
