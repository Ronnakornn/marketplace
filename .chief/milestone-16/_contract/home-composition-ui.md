# Home Composition UI Contract

## Purpose

The buyer home page must be a complete commerce entry point, not a collection of placeholder sections.

## Required Sections

- Buyer top bar with search, account/cart entry points, and locale-safe links.
- Hero promotion area with a primary commerce action and responsive image/layout treatment.
- Voucher/promotion strip with claim or browse actions where supported by current APIs.
- Flash Sale section with sale urgency, price contrast, stock/progress context, and stable card sizing.
- Category grid with clear category labels and no mobile text overlap.
- Product rails for recommended products, new arrivals, and recently viewed products.
- Featured shops section with seller/storefront entry points.
- Sticky cart/checkout CTA where there is buyer cart context.
- Mobile bottom navigation for key buyer destinations.

## State Requirements

- Loading states must preserve layout stability and avoid jumping rails.
- Empty sections must degrade into useful browse actions or stay hidden when the absence is not actionable.
- Error states must offer retry when the home query can be retried.
- The page must remain usable if one optional section has no data.

## Layout Requirements

- Desktop and mobile layouts must avoid text overlap, clipped controls, and touch targets smaller than expected for primary actions.
- Fixed-format elements such as rails, cards, bottom navigation, counters, and sticky CTAs must have stable dimensions.
- Page sections should be full-width bands or unframed layouts; cards are reserved for repeated commerce items or framed tools.

## Boundaries

- Keep home-specific orchestration in `app/features/marketplace/`.
- Do not introduce a mini cart drawer.
- Do not redesign cart, checkout, payment, order, seller, or admin surfaces.
