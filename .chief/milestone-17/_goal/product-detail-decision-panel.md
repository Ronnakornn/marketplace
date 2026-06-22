# Product Detail Decision Panel

## Goal

Make the product detail decision area clear, compact, and trustworthy for buyer purchase decisions.

## In Scope

- Product title, shop/brand context, rating, sold count, stock, price, variant selection, quantity, and purchase status.
- Clear selected variant summary and disabled purchase reasons.
- Stable layout for desktop and mobile.
- No text overlap or clipped controls in the decision panel.

## Out of Scope

- Product listing/search redesign.
- Home page redesign.
- Seller/admin product management surfaces.
- Payment/order success changes.

## Constraints

- Keep buyer product UI logic inside `app/features/product/`.
- Do not trust client-provided pricing or stock.
- Reuse existing product detail API and normalized buyer product data where practical.
