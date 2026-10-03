# Settlement design review

Read [candidate A](settlement-candidate-a.md) and [candidate B](settlement-candidate-b.md) in full. This is an independent GPT-family design review, not cross-family review or runtime verification. Scores assess the proposed designs, not implemented behavior.

| Criterion | A /5 | B /5 |
|---|---:|---:|
| Funding conservation and original fee facts | 5 | 5 |
| Zero cash and refund before recognition | 5 | 5 |
| Bounded repeated refunds and cash caps | 4 | 5 |
| Legacy compatibility | 4 | 5 |
| Minimal typed implementation | 5 | 3 |
| Rollout testability | 4 | 5 |

Use A's separate item/shop snapshot and refund-allocation models as the base. They preserve existing scalar fixtures and keep funding facts immutable. Graft B's saved explicit component plans, authoritative shipping decisions, and reservation of capacities for plans that can already execute external cash transfers. Keep calculation in domain services and transaction ownership in repositories. A generic settlement facade is unnecessary.

Both designs correctly separate cash from seller entitlement. Their scalar item-component targets reach original amounts at full returned quantity, and the snapshotted original fee prevents later rate changes from repricing returns. Both recognize only remaining entitlement after an early refund, including fully subsidized zero-cash merchandise. Recognition must remain durable even when its result is zero.

## Synthesis gates

- Preserve the current one-coupon API. A's step to enable simultaneous shop and platform selections exceeds this increment. Snapshot whichever coupon is actually selected, with its funding owner, and snapshot coins separately. Test seller-funded and platform-funded checkout cases separately. The combined literal example can test pure arithmetic without advertising an unsupported checkout selection.
- Freeze an explicit refund plan before cash execution. Its cash sum must equal Refund.amount. Under the Order lock, count successful consumption and other externally executable reserved plans against original rights. Pending reservations do not become successful reversals; they prevent overlapping externally committed cash promises. Do not infer returned merchandise or fee rights from an amount.
- Define the legacy branch explicitly. Missing snapshots must neither mean zero discounts nor trigger current-policy reconstruction. Retain the validated existing legacy path where authorized. New component settlement on legacy orders requires audited original facts or a review-required conflict. Partially present snapshots are corruption, not an automatic fallback.
- Keep one lock order across payout writers. B proposes ShopWallet then SellerPayout, while the current payout service locks SellerPayout then ShopWallet. Mixing those orders can deadlock. Retain the existing order consistently for this increment. Settlement keeps Order then sorted ShopWallet then BuyerCoinWallet, without subsequently acquiring payout locks.
- Bound every component's cumulative successful consumption independently. Reject inconsistent history rather than posting a negative reversal. A future admin component plan and partial-quantity return cannot both consume the same rights. Scope current rollout to supported full-line returns until mixed partial-component history semantics are encoded and tested.
- Shipping cause needs authoritative approval and shipment evidence. Buyer free text cannot select seller fault. Do not automatically enable unresolved partial-shop shipping, goodwill, coupon reissuance, cashback, or affiliate rules.
- Preserve exact money at the database boundary. A identifies the existing BigInt-to-Number extension. New arithmetic cannot recover digits already lost by that extension. Use exact settlement reads or validated safe bounds and keep DTO precision explicit.

The payout wallet recheck is useful local protection. It cannot undo a manual bank transfer already sent. B's durable pre-transfer authorization is a separate required activation gate before claiming protection of external transfer/refund races. Unknown transfer outcomes remain held for reconciliation.

## First verifiable slice

Implement additive snapshots, regeneration, and pure literal accounting tests first. Then verify checkout, recognition, and full-line component refund together on isolated PostgreSQL before activating new-policy writes. Include zero cash, refund before recognition, changed commission rate, repeated/concurrent completion, shipping retained/refunded, corrupt history, and rollback. Keep legacy and new-policy fixtures distinct. No implementation or provider evidence is claimed by this review.
