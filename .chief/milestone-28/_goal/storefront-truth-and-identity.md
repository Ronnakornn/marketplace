# Goal: Public Storefront Truth and Identity

## Outcome

Each active shop has a public storefront that represents the real shop rather
than static or inferred placeholder claims. Buyers can identify the shop,
understand its trust signals, and distinguish available capabilities before
acting.

## Scope

- Present the shop's real logo, optional cover, description, rating summary,
  review count, follower count, and total active-product count.
- Use an adaptive identity header: cover plus overlaid logo when a cover exists,
  and a compact header when it does not.
- Show chat availability only when the active shop has chat enabled.
- Show the latest three published shop reviews and provide a path to the full
  published review history.
- Show non-empty shipping and return policies as plain text.
- Give the shop owner a management action instead of buyer-only follow and chat
  actions.

## Success Criteria

- No visible shop metric or capability is derived from the number of products
  loaded into the current page.
- Missing optional media or policy content produces a deliberate compact state,
  not a fake value or empty reserved area.
- Private shop contact and ownership details are not exposed to public clients.
- Inactive shops remain unavailable through the public storefront route.

## Non-Goals

- Publicly exposing seller contact email, phone, staff, or operational settings.
- Rendering seller-authored HTML.
- Adding storefront theme customization beyond the shared marketplace design.
