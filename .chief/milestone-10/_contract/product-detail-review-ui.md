# Contract: Product Detail Review UI

## Existing Surface

Extend `app/features/product/components/ProductDetailPage.tsx` and product query helpers.

## Data Sources

- `GET /api/products/:productId/reviews`
- `GET /api/products/:productId/rating-summary`

## UI Requirements

- Product detail fetches reviews and rating summary for the active product.
- Render average rating, total count, and distribution when available.
- Render review cards with reviewer name, rating, comment, media thumbnails, created date, and purchased item snapshot.
- Preserve current variant selection, stock, add-to-cart, and buy-now behavior.
- Show empty, loading, and error states inside the review section.

## Data Rules

- Render only persisted review media URLs returned by the review API.
- Do not trust client-side rating calculations when rating summary API data exists.
- Do not expose unpublished reviews.

## Verification

- Frontend tests cover populated reviews, empty reviews, media rendering, and rating summary display.
- Existing product detail buyer state tests remain passing.
