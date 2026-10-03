# Configurable tax and cumulative returns

The owner accepted configurable tax, partial quantities, merchandise affiliate
reversals and shop coupons followed by platform coupons. The independent design
review selects candidate A, 21/25, with candidate B's included/added names and
complete-record validation. This is an implementation contract, not test proof.

Tax is zero unless configured. A nonzero policy explicitly records the rate in
parts per million, inclusive or exclusive prices, merchandise funding basis,
shipping taxable flag, LINE_HALF_UP rounding, SELLER custody and BUYER funding
of exclusive tax. Shipping uses seller shipping after waiver. Rates in tests are
examples; the application does not determine the legally applicable rate.

For rate r expressed as a percentage, inclusive tax is gross*r/(100+r).
Exclusive tax is net*r/100. Discounts precede tax. Each extended item line and
each shop shipping charge rounds half up to a minor unit. This follows the
[inclusive/exclusive arithmetic and line-rounding distinction](https://docs.stripe.com/tax/tax-rates).
The Thai Revenue Department also illustrates inclusive tax as
[gross*7/107](https://vrtweb2.rd.go.th/15.html). These references establish
arithmetic, not this marketplace's liability or configured tax rate.

Order.taxTotal remains added tax, preserving the payable-total equation.
includedTaxTotal and reportedTaxTotal disclose tax already in the price and
all tax respectively. Original snapshots freeze the complete policy/revision,
buyer/platform/coin net and tax components, seller gross receipts, net commission
basis and buyer net reward/affiliate basis. Policy-one history remains zero tax.

A return owns a quantity interval beginning at successfulQuantityBefore. Every
atomic net/tax component refunds floor(original*(q+k)/Q)-floor(original*q/Q).
For original buyer net of 94 minor units and tax of 7 across three units, cash refunds are 33, 33 and 35 minor units.
Net and tax round independently. Deriving net by subtracting a tax target from
an independently rounded gross target can yield a negative one-cent delta.

One PENDING/PROCESSING refund and one active Return may hold the same item.
Different items may hold plans concurrently. Successful allocations consume
rights; confirmed failure cancels its originating Return and releases its
interval. Every Return mutation first locks Order, then rereads current state.
Successful refund completion closes Return, seller effects, original fee credits,
gross coin restoration and affiliate reversal in the same transaction.

Seller debits use all net plus tax components. Original commission credits use
cumulative successfully reversed merchandise net. Coin restoration uses gross
coin funding net plus tax, preserving the spentCoins*100 identity. Cashback and
affiliate calculation exclude tax and shipping. Affiliate awards retain an
immutable item basis and original amount with separate refund-linked reversals.
Legacy awards without original item evidence fail closed rather than guessing.

Quote acceptance uses the server quote fingerprint, including policy revision
and payable total. A changed quote requires acceptance again. Stable cart-item
keys determine allocations before and after order-item IDs are generated.
Both coupon reservations and all economic effects share checkout rollback.
Refunds create no automatic replacement coupon or goodwill award.

Nonzero activation stays gated until checkout, settlement, Return/refund,
rewards/affiliate and browser/API/DB evidence pass. Real provider and bank
verification still requires the service identity and sandbox access.
