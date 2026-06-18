# Browser Evidence

Captured on clean Next dev origin:

- `http://localhost:3020/en/products/80cabf5f-03f9-40a2-9aac-6044480aa1c9`

## Files

- `product-detail-review-qa-desktop.png`
- `product-detail-review-qa-mobile.png`
- `product-detail-review-qa-filtered-mobile.png`

## Observed State

- Seed product: `Relaxed Linen Resort Shirt`.
- Desktop and mobile evidence showed:
  - `Reviews`
  - rating summary
  - `All ratings`
  - `With media`
  - `With comment`
  - `Latest`
  - `Rating high`
  - `Rating low`
  - `Questions & answers`
  - `Answered`
  - `Unanswered`
  - `Oldest`
- Browser DOM check found no horizontal overflow in desktop or mobile viewport.
- Browser logs for the clean `localhost:3020` evidence tab had no local warning/error entries.

## Decision Captured During Evidence

The seeded review media uses `https://example.com/demo/review-1.jpg`. Rendering review thumbnails through `next/image` crashed because `example.com` is not configured as an allowed image host. The implementation was adjusted to render review media thumbnails with a standard lazy `<img>` inside the existing review media link instead of changing global `next.config.mjs`.

