# Seller Page Performance Baseline

Measured locally on 2026-05-24 at `http://localhost:3000/th/seller` with `bun run dev`.

## Scope and Method

- Started the local Next.js frontend and Elysia backend.
- Used local seeded active seller credentials from `scripts/seed.ts`: `seller-fashion@example.com` / `DemoPass123!`.
- Captured HTTP-level timings with `measure-seller-baseline.ps1`.
- Did not perform browser/manual acceptance testing. These numbers do not include visual paint, JS chunk loading, hydration completion, or real user interaction timing.

## Raw Measurements

### Authenticated Active Seller

| Request | Status | Client elapsed | Server observation |
| --- | ---: | ---: | --- |
| `POST /api/auth/sign-in/email` | 200 | 1735 ms | Backend logged 1557.26 ms, slow request |
| `GET /th/seller` cold | 200 | 14128 ms | Next logged 10.5 s: `next.js` 4.0 s, `generate-params` 3.7 s, `application-code` 6.5 s |
| `GET /th/seller` warm repeat | 200 | 3551 ms | Next logged 952 ms: `next.js` 92 ms, `generate-params` 44 ms, `application-code` 816 ms |
| `GET /api/seller/dashboard` cold | 200 | 1236 ms | Backend logged 741.23 ms, slow request |
| `GET /api/seller/dashboard` warm repeat | 200 | 421 ms | Backend logged 49.95 ms |

### Unauthenticated Control

| Request | Status | Client elapsed | Result |
| --- | ---: | ---: | --- |
| `GET /th/seller` | 307 | 2716 ms | Redirected to `/th/login?next=%2Fth%2Fseller` |
| `GET /th/seller` repeat | 307 | 2617 ms | Redirected to `/th/login?next=%2Fth%2Fseller` |
| `GET /api/seller/dashboard` | 401 | 30 ms | Unauthorized |
| `GET /api/seller/dashboard` repeat | 401 | 5 ms | Unauthorized |

Raw output is in `measurement.json`. Dev server logs are in `dev.out.log` and `dev.err.log`.

## Request Behavior

- A direct HTTP navigation to `/th/seller` produces one seller route request.
- Because this is not a browser run, it does not automatically execute the client `useSellerDashboard()` query.
- The dashboard page code uses TanStack Query and should issue `GET /api/seller/dashboard` after client render/hydration in a browser.
- Direct repeated dashboard API calls showed a large improvement from 717.95 ms backend duration to 49.46 ms backend duration.
- Local logs showed a Redis/cache warning on the first dashboard request:
  - `Cache get failed`
  - `CACHE_CONNECTION_FAILED`
  - `Stream isn't writeable and enableOfflineQueue options is false`

## Likely Dominant Delay Bucket

The dominant user-visible delay is most likely route/RSC rendering plus server-side auth/seller access checks before the usable seller shell can appear.

Evidence:

- Cold authenticated `/th/seller` was about 14.1 s client elapsed and 10.5 s in the Next log.
- Next attributed the cold request mostly to `application-code` 6.5 s plus `generate-params` 3.7 s.
- Warm authenticated `/th/seller` still spent about 816 ms in application code in the Next log.
- The seller layout and page both call seller access code through `getSellerAccess()` / `enforceSellerRoute()`. React `cache()` should dedupe within a single RSC request, but each navigation still performs server-side session and seller shop/application resolution.

Dashboard API/data fetching is a secondary delay bucket:

- It is not required for the shell HTML response in the HTTP-only measurement.
- It becomes visible after hydration because `SellerDashboardPage` fetches `GET /api/seller/dashboard`.
- Cold dashboard API was 741.23 ms backend duration and warned about cache access; warm repeat dropped to 49.95 ms.

Client render/hydration could not be measured in this task because no browser/manual flow was run.

## Limitations

- No browser network waterfall or visual-ready timestamp was captured.
- No console errors were captured because browser automation/manual acceptance testing is outside builder-agent scope.
- The measurement used local seeded credentials and depends on the local database containing that seed data.
- Timings are development-mode timings; they are useful for before/after comparison in this milestone, not production latency claims.
