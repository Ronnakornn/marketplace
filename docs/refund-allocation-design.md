# Bounded cumulative refund allocation

## Problem

`completeRefundSuccess` serializes refunds with an Order lock, but recalculates
every order-wide refund from the original Shop Order weights. Two shops paid
1 minor unit each can consequently receive debits 0 and 2 after two refunds of
1. The database reproduction is in
[red.log](test-evidence/2026-10-04-refund-allocation/red.log).

## Usage

The caller continues to complete a refund through `completeRefundSuccess`.
Within that transaction, the repository reads actual previous refund debits and
asks the amount service to calculate the next debits.

For two shop caps of 1, prior debits 0 and 1, and a new refund of 1, the plan is
1 and 0. A targeted return uses only the named shop's remaining capacity.
Missing or overdrawn historical allocations produce a conflict before writes.

## Shape

`refund-amount.service.ts` owns one pure calculation with an object argument.
The request distinguishes an order-wide refund from a shop-specific return.
Shop positions derive from ShopOrder projections plus actual refunded amounts.
Amounts use BigInt minor units. No schema, public repository API, commission,
coin, or discount-funding change is involved.

The calculator sorts shops by ID, calculates ideal allocations at the cumulative
refund total, and subtracts actual historical shop debits. A shop whose existing
debit exceeds its next ideal receives a zero deficit. The new amount is allocated
across the nonnegative deficits with the existing integer allocator.

When every next ideal remains feasible, the deficits sum to exactly the new
amount, so this preserves the old cumulative ideal. Otherwise deficit capacity
is at least the new amount and no deficit exceeds its shop's remaining cap.
New debits therefore remain nonnegative and conserved. At full refund, every
shop reaches exactly its original cash-allocation cap.

The repository retains the Order lock through history reads, planning, status
transition, wallet locks, debit writes, and coin reversal. A successful historical
refund must have matching debit sums and currency. A historical return's entries
must belong to its return shop. Inconsistent or missing histories are not
reconstructed or repaired by this path.

## Synthesis decision

Two independent sketches compared cumulative deficits and remaining-capacity
weights. A separate GPT-family judge agreed with the parent to select cumulative
deficits. On caps/conservation, feasible cumulative proportions, mixed returns,
history safety, interface, and transaction safety, the judge scored candidate A
5/5/5/4/5/5 and candidate B 5/2/5/5/5/5.

Candidate B contributed explicit historical return-shop validation and zero
amount handling. A different model family was unavailable, so this is not a
cross-family verdict.

## Tradeoffs

Exact event conservation, no negative new debit, per-shop caps, and identical
full-refund totals are the contract. Arbitrary partial refunds split into different
request sizes do not necessarily yield the same intermediate allocation.

Direct subtraction of cumulative targets is unsafe. With caps 2/1/2, the existing
targets change from 0/1/1 at total 2 to 1/0/2 at total 3. Subtraction would generate
1/-1/1. The probe is in
[cumulative-target-probe.json](test-evidence/2026-10-04-refund-allocation/cumulative-target-probe.json).

Remaining-capacity weights are bounded but change proportions even when the old
cumulative ideal remains feasible. A monotone cent-order or divisor allocator
could define stronger partition independence, but introduces a new rounding
policy. That is outside this fix.

## Verification contract

Use literal expected balances at the existing database completion seam. Cover
sequential cents and replay, simultaneous different refunds, decreasing target
components, targeted return followed by order-wide exhaustion, targeted refunds
above remaining shop capacity, and corrupt legacy history. Existing coin-failure
rollback and payment ceilings must continue to pass.

Funding, commission, shipping-refund rules, and legacy reconciliation remain
separate business or operational decisions. This fix does not infer them from
ShopOrder.grandTotal.
