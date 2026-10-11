# Support and repeat purchase contract

## Design decision

One support module owns Ticket, TicketMessage and Dispute writes and participant privacy. Independent design review chose ticket-centric candidate A, with candidate B's exact rejected-return identity and retry-safe cart contract. Separate support/dispute writers were rejected because they would duplicate conversation authorization. Private image evidence is deferred; this increment accepts text evidence and order/return context.

## Support

- Add nullable unique `DisputeCase.returnRequestId` and a ReturnRequest relation with a generated migration. Existing tickets and disputes remain valid.
- Buyer general tickets may have optional order and shop context. Orders must belong to the buyer, and any shop must belong to that order. A shopless ticket is buyer/admin only.
- Appeal creation accepts a ReturnRequest ID, verifies an owned REJECTED return under the existing Order lock, derives order/shop identity and atomically creates a ticket, initial message and dispute. Repeated or concurrent requests return the existing case rather than create another.
- Lists and conversations are paginated. Buyer reads filter owner. Seller reads require the operational macro and active shop ownership, matching the existing return workflow. Shop staff access is outside this increment. Administrators use the role macro. Non-admin message queries filter `isInternal=false` before pagination and counts. Never expose another shop's order items, shipping address, user email or global payment facts to a seller.
- The server derives sender identity/type. Only admins can write internal notes. Internal notes do not change public workflow state.
- Use explicit ticket and dispute transition tables. Decisions require nonempty text. Persist decision, time and a server-derived administrator SYSTEM message atomically. Terminal disputes cannot be reopened or rewritten. Do not expose COMPENSATED or arbitrary compensation inputs.
- A support decision has no payment, refund, wallet, inventory or Return status side effects. Existing refund processes remain available for separate authorized execution.
- Buyer support list/create/detail plus order contextual return-appeal entry, seller list/detail/reply and admin list/detail/review/private notes must be discoverable through existing navigation.
- Thai and English strings, loading/error/empty states, request pending guards and accessible form labels are required.

## Buy again

- One authenticated POST accepts only an order ID, verifies buyer ownership and derives historical variant IDs/quantities on the server.
- CartService owns live catalog checks and one locked-cart transaction. Aggregate repeated historical SKUs and ensure target quantity `max(existing quantity, original quantity)` without reducing larger existing quantities. Retrying and concurrent requests must not add the same historical quantities again.
- Check ACTIVE variant/product/shop, current `quantityOnHand - quantityReserved`, current price and currency. Update current price/currency on existing cart rows. Existing cart quantities are not silently reduced.
- If stock cannot cover the requested historical target, an explicit partial result may add available units without reducing current cart quantity. If already over available stock, return an explicit skipped result.
- Return inferred per-item outcomes, quantities, current money and reasons for unavailable/deleted/out-of-stock items. Expected availability refusals can coexist with successful additions; unexpected database errors roll back all changes.
- The order detail button displays added/skipped outcomes and an Open cart action. Disable during the request, guard immediate double clicks, invalidate buyer-cart state. An all-skipped result stays on the order page.
- No stock reservation, checkout, payment or historical snapshot mutation occurs.

## Verification

Test buyer/seller/admin isolation, internal-note exclusion including pagination/counts, rejected-return eligibility, concurrent duplicate appeal, terminal transition rules and atomic decision rollback. Test current-price merging, inactive/missing variants, existing quantities, reserved stock, partially available orders, duplicate request behavior and transaction rollback. Run generation after schema changes, typecheck, focused and full tests, i18n parity, build, actual PostgreSQL transaction checks and focused browser journeys.

## Workstream ownership

Support owner works only in the managed support-cases worktree. Repurchase owner works only in order-repurchase. Translation files and OrderDetailPage are integrated sequentially by the parent. Preserve the user's current docs/user-guide.html edit. Root owns this milestone, integration and final verification.
