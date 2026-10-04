# Seller shipping input composition

The actual Chromium shipping form sent `shippingFeeBaht: "49.95"`, but the production route rejected it as an unexpected property. The original `t.Intersect` retained `additionalProperties: false` on the generated settings subset; that subset could not accept the explicit shipping/localization extension. The profile composition had the same defect for localized descriptions.

Both request schemas now use `t.Composite` to merge the generated `t.Partial(t.Pick(...))` fields and the existing extension fields into one object with `additionalProperties: false`. No Prisma fields, validators, ownership checks, or amount conversion rules were duplicated or changed. The schemas are exported for direct closed-schema regression assertions.

## Evidence

- `shipping-route-before.json`: **2 passed, 1 failed**. The authenticated composed route rejected literal `"49.95"` with `/shippingFeeBaht: Unexpected property`. Elysia's standalone response is 422; the complete application's error adapter reports 400 in `browser-numeric-final-chromium.log`.
- `shipping-route-after.json`: **38 passed, 0 failed**: 24 route/schema cases and the existing 14 service cases. HTTP tests cover exact string preservation, compatible numeric inputs, generated fields combined with all localized extensions, localized profile fields, sub-satang string rejection, numeric bounds, localized text lengths, and private-field isolation.
- Unknown properties fail `Value.Check` against the closed composed schemas. Existing Elysia normalization strips those properties before calling the service and returns HTTP 200 for the remaining valid input. Tests explicitly verify that `shippingFee`, `version`, `ownerId`, and profile `status` never reach the service. This report does not claim HTTP rejection of stripped fields.
- `shipping-route-typecheck.log`: workspace `bunx tsc --noEmit` completed with exit 0 and no diagnostics.

The route regression uses the real route factory and authentication/readiness macros with mocked identity/readiness/service dependencies. Its sub-satang input never reaches the service. Actual UI/API/DB shipping conservation and held physical stock are covered by `e2e/numeric-shipping.spec.ts`: literal `49.95`, DB `4995n`, quote `"4995"`, immutable order/shop/sale facts, and payment `104995n`; then 10 held physical units clamp a flash campaign with 20 quota and no flash reservations to zero available units. The root agent runs browser acceptance and records its result separately; this unit does not claim a browser rerun.
