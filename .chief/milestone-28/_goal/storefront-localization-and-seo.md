# Goal: Localized Storefront Content and SEO

## Outcome

Thai and English storefront routes present localized shop-authored content and
accurate search/share metadata while preserving every existing shop record.

## Scope

- Allow sellers to maintain Thai and English shop descriptions, shipping
  policies, and return policies from Seller Settings.
- Keep all localized fields optional and resolve content using the fallback
  order: requested locale, existing base field, alternate locale.
- Use localized shop content, existing SEO fields, canonical shop slug, and a
  validated cover image in storefront metadata with safe fallbacks.
- Keep all storefront controls, states, labels, and accessibility text complete
  in Thai and English.

## Success Criteria

- Existing shops require no immediate data rewrite after migration.
- Missing localized content never hides an available base policy or description.
- Thai and English message keys remain in parity and pass the repository i18n
  audit.
- Metadata never renders unsafe URLs, unbounded text, or private shop data.

## Non-Goals

- Runtime AI translation of seller-authored content.
- Making both languages mandatory before a shop can be active.
- Adding a translation-management service.
