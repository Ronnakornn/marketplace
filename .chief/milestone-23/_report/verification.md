# Milestone 23 Verification

## Summary

Buyer-facing i18n completion was verified with the deterministic i18n audit, TypeScript checking, focused buyer/product tests, and EN/TH browser evidence for public home and authenticated wishlist.

## Commands

- `bun run audit:i18n`
  - Result: passed.
  - Key parity: 618 English keys / 618 Thai keys.
  - Placeholder parity: ok.
  - Remaining scoped findings covered by baseline: 17 intentional findings.
- `bunx tsc --noEmit`
  - Result: passed.
- `bun run test -- app/features/product/cart-handoff.test.ts app/features/product/components/ProductCard.test.tsx app/features/product/components/ProductBuyerStates.test.tsx app/features/buyer/components/ProfilePage.test.tsx app/features/buyer/components/WishlistPage.test.tsx app/features/marketplace/components/MarketplaceHome.test.tsx app/features/product/queries.test.ts`
  - Result: passed, 7 files / 86 tests.

## Browser Evidence

- `home-en.png`
  - URL: `http://localhost:3000/en`
  - State: public home entry page in English.
- `home-th.png`
  - URL: `http://localhost:3000/th`
  - State: public home entry page in Thai.
- `wishlist-en.png`
  - URL: `http://localhost:3000/en/wishlist`
  - State: authenticated demo buyer wishlist in English.
- `wishlist-th.png`
  - URL: `http://localhost:3000/th/wishlist`
  - State: authenticated demo buyer wishlist in Thai.

## Runtime Notes

- Local dev server was started with `bun run dev`.
- The local Redis service was not running, so backend logs contained repeated `ECONNREFUSED` entries for Redis on port 6379.
- Home evidence still rendered enough localized shell/home labels for EN/TH verification, but product feed data remained in loading/skeleton state under the local Redis limitation.
- Authenticated wishlist evidence was captured by signing in as `buyer.demo@example.com` through Better Auth and applying the resulting session cookie to headless Chrome.
- In-app browser screenshot capture timed out during this run, so Chrome headless/CDP was used to produce the PNG evidence.

## Remaining Baseline Findings

The i18n audit baseline still contains 17 intentional findings for machine strings, route templates, generated IDs, formatter literals, composed filter labels, and API/user-provided content that should not be translated in this milestone.
