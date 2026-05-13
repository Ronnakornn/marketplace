# Review Domain

The Review domain owns buyer product reviews tied to purchased items.

## Responsibilities

- Review eligibility
- Rating
- Review body
- Review media references
- Product review summary
- Duplicate review prevention

## Business Rules

- Buyers can review only purchased eligible order items.
- Review should usually require delivered or completed order state.
- One eligible order item should not be reviewed multiple times.
- Review summary updates product detail and product cards.

## API Surface

- `POST /api/orders/:orderId/reviews`
- `GET /api/products/:productId/reviews`

## Frontend Surfaces

- Product detail reviews
- Order detail review CTA
- Review form

## Edge Cases

- Review window closed.
- Already reviewed.
- Order not delivered.
- Product archived after purchase.

## Acceptance Criteria

- Review creation validates buyer ownership and eligibility.
- Product detail displays review summary and list.
