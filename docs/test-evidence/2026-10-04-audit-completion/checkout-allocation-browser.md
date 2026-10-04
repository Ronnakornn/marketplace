# Original funding allocation browser fixture

The two-shop fixture now has ordered shop UUID prefixes, with unique random suffixes. Its literal expectations therefore have a fixed ordering for residual minor units. Production allocation still uses original stable shop and cart identities.

Platform discounts allocate first. Coin funding then allocates against the remaining merchandise. These are separate original pools, so rounding their sum as one discount does not produce the same result in every case.

| Basket | Original lines | Platform shares | Coin shares | Shop discount totals | Shop payable totals including shipping |
| --- | --- | --- | --- | --- | --- |
| Coupon and coins | 2598, 1998 | 361, 279 | 452, 348 | 813, 627 | 2135, 1821 |
| Flash, coupon and coins | 1800, 1998 | 303, 337 | 331, 369 | 634, 706 | 1516, 1742 |

These goldens were worked out separately with exact integer fractions, without importing checkout allocation code. The original full-basket payable totals remain 3956 and 3258. The initial browser run used random shop ordering and the old combined-discount expectation. It failed on the original pool distribution, while full-basket UI, quote and database totals agreed. The corrected fixture tests the sequential allocation contract explicitly.
