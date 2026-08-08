# Contract: Storefront Localized Data and SEO

## Prisma Additions

Add nullable fields through `prisma/schema.prisma`:

```text
Shop.descriptionTh       String?
Shop.descriptionEn       String?
ShopSetting.shippingPolicyTh String?
ShopSetting.shippingPolicyEn String?
ShopSetting.returnPolicyTh   String?
ShopSetting.returnPolicyEn   String?
```

- Existing base fields remain intact and backward compatible.
- The migration adds nullable columns and requires no destructive backfill.
- Regenerate Prisma and Prismabox outputs; generated files are never edited by
  hand.

## Seller Management

- Seller shop-profile updates accept `descriptionTh` and `descriptionEn`.
- Seller settings updates accept Thai and English shipping and return policies.
- All updates use existing ownership, active-shop, validation, query-key, and
  cache-invalidation rules.
- Blank input normalizes to `null`; bounded plain text is required.
- Seller forms label both languages explicitly and preserve existing base-field
  content during migration.

## Localization Fallback

Resolve seller-authored fields as follows:

```text
Thai route:    Thai field -> existing base field -> English field -> null
English route: English field -> existing base field -> Thai field -> null
```

- Shop and product names remain seller-authored data and are not machine
  translated.
- Runtime AI translation is prohibited for policy and storefront copy.

## Metadata and Canonical URL

- Canonical storefront URL uses `/<locale>/shops/:slug`; UUID access resolves to
  the same canonical slug.
- Metadata title prefers bounded `metaTitle`, then shop name.
- Metadata description prefers bounded `metaDescription`, then localized shop
  description, then the translated system fallback.
- Social image prefers a validated public cover URL, then logo, then the site
  fallback image.
- Structured data uses only active-shop facts and omits unavailable optional
  values rather than inventing claims.

## i18n

- Every new control, state, action, aria-label, and validation message exists in
  both `messages/en.json` and `messages/th.json` with placeholder parity.
- Existing locale navigation helpers remain authoritative.
