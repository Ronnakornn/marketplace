# Candidate B: separate original tax records

## Grounding

CheckoutQuoteEvaluator currently returns taxTotal zero. CheckoutRepository rejects
nonzero tax and stores policyVersion one. ItemSaleSnapshot conserves gross minus
seller discount across buyer cash, platform coupon funding and coin funding.
ShopSaleSnapshot uses that seller entitlement as commissionBase. Wallet earnings
currently use commissionBase as merchandise revenue. Refund components return
the full original item quantity, and completion divides gross reversed rights by
commissionBase to credit the original fee. These identities must change together
for inclusive VAT; changing taxTotal alone breaks revenue and fee reversals.

ReturnService always requests the purchased quantity and blocks a second active
return. ReturnItem already stores quantity. There is no separate original return
entitlement model. Approved requests remain active after refund completion, so
sequential partial returns also need terminal status/capacity handling.

## Usage sketch

```ts
const quote = calculateTaxForAcceptedSale(config, merchandise, shipping)
// commitCheckout persists quote and all original tax components in its transaction.
const refund = planOriginalTaxRefund(originalTax, successfulQuantities, requested)
// refund completion uses saved components, not current admin configuration.
```

The alternative owns OrderTaxSnapshot, ItemTaxSnapshot, ShopTaxSnapshot and
RefundTaxAllocation records. Typed relations distinguish an inclusive reported
tax from an exclusive added tax. Existing Order.taxTotal remains added tax, so
the existing grandTotal equation remains valid. API responses add included tax
and the frozen configuration. No additional tax is inferred for old orders.

Configuration includes rateBps, inclusive/exclusive mode, half-up/floor rounding,
whether shipping is taxable, and the merchandise tax base. The base selects
buyer price after every discount or seller entitlement after seller discount.
The operator must select the applicable treatment of third-party funding before
enabling a nonzero rate. The code does not establish a legal tax obligation.
Default zero preserves existing orders. Config is stored through SystemSetting,
validated on admin input, and snapshotted on commit.

Each original tax record stores the taxable basis, reported tax, buyer added tax,
included tax, and funding responsibility. Seller earning includes tax collected
for the seller. Commission excludes merchandise tax and shipping. Refund gross
rights include the original tax collected. Included tax is part of the cash
already being returned; exclusive added tax increases cash refund. Fee reversal
uses the original net merchandise rights reversed, including cumulative original
tax rounding. Full reversal must credit exactly the original purchased fee.

## Literal cases

At a configured 700 bps, exclusive 10000 cents yields tax700 and total10700.
Inclusive10700 yields includedTax700, net10000 and unchanged total10700.
Exclusive taxable shipping1000 adds70; untaxed shipping1000 adds0.
The half-up result for taxable50 at100 bps is1, while floor is0.
Three returned units sharing original tax2 refund tax0,1,1 sequentially.
Changing config after purchase cannot change any of these purchased facts.

For simultaneous same-item partial plans, a separate reservation of immutable
quantity ranges would freeze which units own remainder cents. Failed plans
release only their ranges. Different return plans could then complete in any
order. This needs ranges on allocation rows and validation of overlapping ranges.
An alternative keeps the existing one-active-return-per-item restriction and
allows the next partial only after success or failure. That is smaller and avoids
repricing a frozen pending refund after another fails. Other items/orders remain
concurrent. The latter is the proposed first increment.

## Risks and tradeoffs

Separate tax records avoid adding optional fields to policy-one snapshots but
require four new tables, relation joins and atomic presence validation. The
existing funding and wallet code still needs a policy-two branch, so separation
does not eliminate migration work. Missing partial tax records must fail closed.
All quote, commit, earnings, refund, DTO and UI readers migrate as one unit.

The proposal is a design, not executed proof. No nonzero tax is enabled. Required
gates include pure literal math, actual quote/API/payment/DB equality, immutable
tax configuration, cumulative partial rounding, original fee reversal, failure
rollback, overlapping request rejection, successful terminal return status and
full final restoration.

## Sources

[Revenue Department FAQ](https://vrtweb2.rd.go.th/15.html) demonstrates inclusive
extraction using7/107. The example does not choose this marketplace's tax rate.
[Stripe tax rates](https://docs.stripe.com/tax/tax-rates) documents inclusive and
exclusive arithmetic, discounts and line versus invoice rounding. Shipping and
third-party funding configuration are product design choices, not legal claims
derived from those pages.
