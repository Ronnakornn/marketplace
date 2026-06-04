# Contract: Verification

## Automated Checks

Run:

```bash
bunx tsc --noEmit
bun run test
```

Backend tests should cover:

- homepage discovery composition with missing optional sections
- product listing filters and sort parameters
- public listing excludes inactive products and shops
- tracking endpoint payload validation
- sitemap excludes non-public products

Frontend tests should cover:

- homepage section loading/empty/error states
- search filter URL state
- mobile filter sheet
- product card quick actions
- empty search/listing states

## Browser Checks

Use Browser/Playwright screenshots for:

- homepage desktop
- homepage mobile
- search results desktop
- search results mobile filter sheet
- category listing desktop
- product card grid mobile

Browser verification must check:

- no incoherent overlap
- filter controls are usable
- product cards are layout-stable
- optional sections degrade gracefully
- metadata/SEO routes render without crashing
