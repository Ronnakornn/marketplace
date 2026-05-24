# Buyer Entry Performance Baseline

Measured locally on 2026-05-25 against existing local development servers:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Routes: `/th` and `/th/search?q=phone`

## Scope and Method

- Captured HTTP-level timing buckets with `curl.exe -w`.
- Captured representative public API timings used by the buyer home/search clients:
  - `GET /api/products?limit=50&locale=th`
  - `GET /api/categories?locale=th`
  - `GET /api/coupons?locale=th`
  - `GET /api/search/products?q=phone&sort=newest&limit=40&locale=th`
  - `GET /api/search/suggestions?q=phone&limit=8&locale=th`
- Captured browser-level DOM evidence with local headless Microsoft Edge using `--dump-dom`.
- No production app/server code was changed.

Raw results are in `measurement.json`. Browser DOM evidence is in `browser-home-dom.html` and `browser-search-dom.html`.

## HTTP Measurements

| Request | Status | TTFB | Total | Size |
| --- | ---: | ---: | ---: | ---: |
| `GET /th` cold | 200 | 190.47 ms | 201.95 ms | 58,715 B |
| `GET /th` warm | 200 | 177.09 ms | 187.72 ms | 58,715 B |
| `GET /th/search?q=phone` cold | 200 | 252.72 ms | 317.50 ms | 100,201 B |
| `GET /th/search?q=phone` warm | 200 | 216.11 ms | 274.61 ms | 100,201 B |
| `GET /api/products?limit=50&locale=th` cold | 200 | 18.23 ms | 19.70 ms | 44,301 B |
| `GET /api/products?limit=50&locale=th` warm | 200 | 14.55 ms | 15.88 ms | 44,301 B |
| `GET /api/categories?locale=th` | 200 | 3.31 ms | 3.42 ms | 1,430 B |
| `GET /api/coupons?locale=th` | 200 | 98.87 ms | 98.99 ms | 1,133 B |
| `GET /api/search/products?q=phone&sort=newest&limit=40&locale=th` cold | 200 | 215.50 ms | 215.64 ms | 112 B |
| `GET /api/search/products?q=phone&sort=newest&limit=40&locale=th` warm | 200 | 2.91 ms | 3.02 ms | 112 B |
| `GET /api/search/suggestions?q=phone&limit=8&locale=th` | 200 | 44.18 ms | 44.29 ms | 40 B |
| `GET /api/categories?locale=th` for search | 200 | 3.87 ms | 3.99 ms | 1,430 B |

## Browser Evidence

Headless Edge DOM dump results:

| Page | Elapsed | DOM size | Observation |
| --- | ---: | ---: | --- |
| `/th` | 3,211 ms | 60,458 B | DOM includes the route shell, metadata, JSON-LD, translations, and an initially empty buyer home client container. |
| `/th/search?q=phone` | 4,265 ms | 93,155 B | DOM includes the search route shell, metadata, translations, and client component payload. |

The browser dump elapsed time includes Edge process startup and is not a precise first paint metric. It is still useful as visible-render evidence because the serialized DOM shows what the browser receives/constructs locally.

Important visible-ready observation:

- `/th` has a blank initial page body for the main marketplace content. `MarketplaceHome` returns an empty `min-h-screen` placeholder until `mounted` becomes true, so the user-visible home content depends on client hydration before meaningful content appears.
- `/th/search?q=phone` is also client-rendered for product results. The server response is larger and includes the client payload, but product grid content depends on browser bundle execution and React Query API calls.

The Edge stderr logs contain Chromium task-manager warnings, not app console errors. No application HTTP errors appeared in the measured responses.

## Dominant Delay Bucket

The dominant buyer-entry delay bucket is client render/hydration and browser bundle work, not public API latency or raw route TTFB.

Evidence:

- Route HTTP totals were modest in the final local run: `/th` around 188-202 ms and `/th/search?q=phone` around 275-318 ms.
- Public API calls were mostly small after warmup. Home product data was about 16-20 ms, categories about 3-4 ms, and warm search products about 3 ms.
- The home page intentionally renders an empty placeholder until client mount, so a blank visible state can persist until JS loads and hydrates.
- Search result data is fetched by a client component after hydration through React Query, so route HTML can arrive before actual product results are visible.

Secondary bucket:

- Search product API had a cold request around 216 ms before dropping to about 3 ms warm, so public search data fetching can contribute on cold cache or first query.
- Coupon API was about 99 ms in this run and can contribute to home feed completion, but it is not the primary blank-screen cause.

## Limitations

- Measurements were taken in local development mode, not a production build.
- Existing local servers were reused because ports 3000 and 3001 were already listening.
- Browser evidence used headless Edge DOM dumps, not Playwright tracing, screenshots, or precise paint metrics.
- The headless browser elapsed time includes browser startup overhead.
- This task did not perform external/manual acceptance testing.
