# Fresh discovery data for homepage server rendering

Actual cross-profile shipping acceptance found a stale homepage: the direct discovery API returned the current flash campaign, but a new mobile homepage navigation rendered the previous campaign, already marked ENDED by the preceding WebKit fixture. The remaining physical stock and campaign identity therefore differed between API and UI. Before-fix artifacts are in `browser-numeric-cross-profiles/numeric-shipping-seller-de-54b90-lds-disable-flash-purchases-mobile-chromium/`; the error context identifies the expected current campaign, while the screenshot shows the previous heading.

## Cause and change

`app/features/home/home-data.server.ts` explicitly used `next: { revalidate: 60 }` when fetching the same discovery URL for each locale. Next's persistent server fetch cache was shared across requests and browser projects. The same initial response is passed to the authenticated homepage and guest SSR homepage by `app/[locale]/(public)/page.tsx`.

The authenticated component seeds this response as TanStack `initialData` and treats it as fresh for another 60 seconds. The personalization key changes only after its existing 10-second delay. The guest SSR component does not perform a subsequent client discovery request. A direct browser API request bypasses this Next server fetch cache; the `/api/*` proxy's existing `Cache-Control: no-store` header does not disable the separately configured server fetch cache.

The narrow fix replaces `next: { revalidate: 60 }` with `cache: "no-store"`. It keeps the API base URL, locale, limit 12, response handling, and failure fallback unchanged. Every new server homepage render now requests current discovery data, including live flash identity and physical holds.

The installed guide `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md` states that `no-store` fetches on every request, and that a positive revalidation interval combined with `no-store` is conflicting configuration. The positive revalidation option was removed entirely. No build, browser, database, schema, or global cache changes were performed by this unit.

## Verification

- `homepage-stock-cache-before.json`: **3 passed, 3 failed** with the original positive revalidation configuration.
- `homepage-stock-cache-after.json`: **8 passed, 0 failed**, comprising six focused SSR tests and two existing discovery normalization tests.
- The public SSR helper is called twice with distinct real `Response` JSON bodies. The resulting campaign changes from `previous-campaign` to `current-campaign`; normalized physical availability changes from 5 to 0; exact price `"9000"` survives. Both requests require only `cache: "no-store"`, preventing accidental conflicting revalidation options.
- Other cases preserve the configured and default API base, Thai locale, limit, and fallback for HTTP failure, request failure, or malformed JSON.
- `homepage-stock-cache-typecheck.log`: workspace `bunx tsc --noEmit`, exit **0**, no diagnostics.

The unit tests stub the external fetch boundary; they do not simulate Next's production cache engine. Subsequent actual browser verification passed `e2e/numeric-shipping.spec.ts` on all five development profiles (`browser-shipping-verified.json`), including checkout-created inventory holds. The latest production build also passed `e2e/numeric-home-freshness.spec.ts` on all five profiles (`browser-production-final.json`): a full homepage navigation reads campaign B after A ends, shows price 80 instead of 90 and physical availability 0 instead of 1, and disables purchases without hydration errors. This production freshness case seeds the inventory transition as a projection precondition; it does not claim payment or checkout lifecycle coverage. Those behaviors are checked separately by the shipping and commerce suites.

## Remaining freshness limit

The existing client discovery query still has `staleTime: 60_000` and no periodic refresh. A homepage already mounted can retain its fetched discovery snapshot; data becoming stale does not itself trigger a request. The existing personalization fetch, mount/focus behavior, and fresh full-page server navigations remain its refresh mechanisms. This fix establishes fresh server-rendered data for navigation; it does not provide real-time updates to an already mounted page. Checkout continues to evaluate authoritative inventory and reserve under its transaction.
