# Cart Count Sync Contract

## Scope

Keep buyer cart count consistent after product add-to-cart actions.

## Required Behavior

- Add-to-cart success invalidates the same cart query keys used by `BuyerShell` and product detail.
- Product detail sticky cart badge updates after successful mutation when cart query is enabled.
- Global buyer shell cart badge updates after successful mutation when visible.
- Product card quick add triggers the same cart invalidation behavior.

## Constraints

- Do not introduce a separate client-only cart count source of truth.
- Do not trust mutation request quantity as the final cart count.
- Cart count should come from refreshed cart API data.

## Error Behavior

- If cart refetch fails after mutation success, add-to-cart confirmation may still show success but should not show a guessed final count.
