# Buyer i18n Audit

## Scope Inventory

- Buyer-authenticated surfaces: `app/[locale]/(buyer)/**`, `app/features/buyer/**`, `app/features/cart/**`, `app/features/checkout/**`, `app/features/order/**`, `app/features/chat/**`, `app/features/affiliate/**`.
- Public shopping surfaces: `app/[locale]/(public)/**`, `app/features/home/**`, `app/features/marketplace/**`, `app/features/product/**`.
- Shared buyer-visible components/helpers: `app/components/BuyerShell.tsx`, `app/components/BuyerState.tsx`, `app/components/LanguageSwitcher.tsx`, `app/features/product/cart-handoff.ts`, `app/i18n/**`.
- Tests/fixtures to exclude from production migration scans but update after string migration:
  - `app/components/BuyerShell.test.tsx`
  - `app/features/buyer/components/ProfilePage.test.tsx`
  - `app/features/buyer/components/WishlistPage.test.tsx`
  - `app/features/marketplace/components/MarketplaceHome.test.tsx`
  - `app/features/product/cart-handoff.test.ts`
  - `app/features/product/components/ProductBuyerStates.test.tsx`
  - `app/features/product/components/ProductCard.test.tsx`
  - `app/features/product/queries.test.ts`

## Summary

- Message key structure parity: no current structural gaps found between `messages/en.json` and `messages/th.json`.
- Placeholder parity: no placeholder mismatches found for existing matching keys.
- Used scoped keys: no currently scanned `t("...")` keys were missing from either locale.
- Primary blocker: `messages/th.json` buyer/public namespaces are mojibake and not readable Thai.
- Primary migration gaps: hardcoded English remains in high-traffic buyer/public components, especially marketplace home, product card/detail, profile, wishlist, and cart handoff toasts.

## Priority Findings

### P0 - Thai locale values are unreadable mojibake

`messages/th.json` values in scoped buyer/public namespaces render as mojibake instead of readable Thai. This affects nearly every already-translated buyer-visible string. Examples:

- `messages/th.json`: `common.account`, `common.cart`, `common.checkout`, `common.loading`, and other `common.*` values display text like `เธเธฑ...`.
- `messages/th.json`: `home.heroTitle`, `home.searchPlaceholder`, `product.addToCart`, `cart.emptyTitle`, `checkout.title`, `order.noOrdersTitle`, `chat.inbox`, `buyer.profile`, `notification.emptyTitle`, `affiliate.title`, `state.retry`, and `ui.close` are similarly mojibake.

Implementation impact: task-3 should normalize `messages/th.json` before or while adding new keys. Otherwise migrating hardcoded English to existing Thai keys will still produce unreadable Thai.

### P1 - Marketplace home has many hardcoded public-shopping strings

`app/features/marketplace/components/MarketplaceHome.tsx` still embeds visible English, empty states, status text, and some malformed separator text:

- `182`: top bar title uses ``Welcome back, ${user.name}`` and `"Marketplace"` directly instead of `home.welcomeBack` / `common.marketplace`.
- `200-237`: product rail titles, subtitles, empty titles, and empty descriptions are hardcoded (`"Recommended for you"`, `"New arrivals"`, `"Recently viewed"`, `"No recommendations yet"`, etc.).
- `318-320`: voucher fallback text includes `"THB 500"`, `"15% OFF"`, `"Selected shops"`, and `"Coins Cashback"`.
- `368`: flash sale fallback uses `Ends ...` and `"Limited-time deals"`.
- `403`: flash sale empty state is hardcoded.
- `486`: request failure text is hardcoded.
- `518`: sale badge is hardcoded as `"Sale"`.
- `533-549`: featured shop empty title/description, heading, `products`, `followers`, and the visible separator `ยท` are hardcoded or malformed.
- `562`: home error state is hardcoded as `"Homepage data failed to load"`.

### P1 - Product detail page has extensive hardcoded visible, aria, placeholder, status, and error text

`app/features/product/components/ProductDetailPage.tsx` is the largest remaining migration surface:

- Error fallbacks: `310`, `367`, `955`, `994`, `1074`, `1112`.
- Purchase and variant state: `343-359`, `372-379`, `425-426`, `547`, `559`, `569`, `590`, `614`, `776`, `809-820`.
- Trust/assurance section: `384-395`, `603`.
- Reviews: `683`, `947`, `962-978`, `983`, `1001`, `1007-1008`, `1220`, `1229`, `1249`, `1259`, `1262`.
- Questions: `708-711`, `1065-1083`, `1089-1094`, `1101`, `1119`, `1125-1126`, `1177-1196`.
- Related/recently viewed rail metadata: `852`, `867`.
- Date formatting is fixed to English at `1282` via `new Intl.DateTimeFormat("en", ...)`.

Implementation impact: this file needs a dedicated namespace expansion for product detail, reviews, questions, variant selection, and purchase status text.

### P1 - Product cards and add-to-cart handoff still expose English UI text

`app/features/product/components/ProductCard.tsx`:

- Badges/status: `64-66`, `141`, `163`, `200`, `209`.
- Aria/title text: `70-71`, `85`, `109`, `132-133`.
- Purchase restriction/error fallbacks: `74-80`.

`app/features/product/cart-handoff.ts`:

- Toast title/description/action text: `5-8`, `33`, `38`.

Implementation impact: cart handoff helpers likely need a translated wrapper or an i18n context passed by caller; this is a design point for task-4 but can be solved locally without backend changes.

### P1 - Buyer profile has hardcoded account/profile/status text

`app/features/buyer/components/ProfilePage.tsx`:

- Profile status and fallback text: `41`, `45`.
- Shortcut text: `57`.
- Success messages: `123`, `132`, `138`.
- Form labels/help/buttons/status: `176-183`, `193`, `198`, `211`, `214`, `221`, `233`, `239`.
- Seller account card text: `268-288`, `298`, `302`, `314`.

Implementation impact: add buyer/account keys for phone verification, profile update success, password change CTA, and seller-status card text. Consider whether seller entry CTAs are in scope because they appear on the buyer profile page.

### P1 - Wishlist has hardcoded toast, aria, action, and availability text

`app/features/buyer/components/WishlistPage.tsx`:

- Remove success/error toasts: `39-49`.
- Availability/status labels: `98-99`, `185-188`.
- Button/title/aria labels and pending text: `139`, `146`, `149`, `159`.
- Fallback removal error: `173`.

### P2 - API normalization fallback strings can become visible

These are not product/shop/user-generated data when used only as missing-data fallbacks, so they should either be localized at render boundaries or documented as audit exceptions:

- `app/features/buyer/api.ts`: `203`, `226`, `233`, `239`, `270`, `278`, `401`, `413`, `431`, `493`, `512-513`, `521`, `557-558`, `561`, `570`.
- `app/features/marketplace/queries.ts`: `187`, `198`, `225`, `236`, `261`, `322`.
- `app/features/product/queries.ts`: `1025`, `1058`, `1198`, `1290`.

Recommendation: keep API/data normalizers free of i18n hooks, but avoid visible English fallbacks by translating fallback labels in components where possible or by adding documented audit exceptions for defensive placeholder data.

### P2 - Other scoped pages are mostly translated but still have small gaps or API status display

- `app/features/buyer/components/VoucherWalletPage.tsx`: coupon fallback labels use English suffixes (`% off`, amount `off`) in `couponLabel`.
- `app/features/order/components/OrderDetailPage.tsx`: order, payment, and shipment statuses render raw API enum values. This may be allowed if documented as API enum/status exceptions, otherwise add localized display helpers.
- `app/features/order/components/NotificationsPage.tsx`: notification titles/bodies are API-provided and should remain unlocalized unless server sends localized data; badge type renders raw API type.
- `app/features/chat/components/ChatPages.tsx`: message bodies are user-generated and correctly not translated; sender/date separator is literal ` - `, likely acceptable.
- `app/features/buyer/components/OrderReviewPage.tsx`, `ReturnRequestPage.tsx`, `DealsPage.tsx`, `PaymentReturnPage.tsx`, `AddressBookPage.tsx`, `FollowedShopsPage.tsx`, `CheckoutPage.tsx`, `CartPage.tsx`, and `OrderListPage.tsx` are mostly already using keys for visible UI.

## Message Key Gaps

No existing used key gaps were found for scoped files. The migration will still need new keys for currently hardcoded strings. Suggested namespaces:

- `home`: marketplace rail titles/subtitles/empty states, featured shops, home load error, voucher fallback labels.
- `product`: product card quick-add labels, wishlist aria labels, product detail purchase/variant/review/question/trust labels.
- `cart`: cart handoff toast titles/descriptions/actions, or a new `cartHandoff` namespace.
- `buyer`: profile phone verification/status/seller-card strings and wishlist removal/availability strings.

## Thai Readability

`messages/th.json` should be treated as globally unreadable for scoped buyer/public namespaces. Do not rely on the current Thai values as copy source. Replace them with readable UTF-8 Thai while preserving:

- key structure,
- interpolation placeholders such as `{name}`, `{count}`, `{amount}`, `{time}`, `{orderNo}`,
- product/shop/user-generated data exclusions,
- concise mobile-friendly phrasing.

## Tests Likely To Need Updates

- `app/components/BuyerShell.test.tsx`: currently stubs English translations and checks top-bar/cart text.
- `app/features/marketplace/components/MarketplaceHome.test.tsx`: asserts hardcoded rail headings, empty states, home load error, and `Retry`.
- `app/features/product/cart-handoff.test.ts`: asserts toast strings (`Added to cart`, `Could not add to cart`, action labels).
- `app/features/product/components/ProductCard.test.tsx`: asserts quick-add aria labels, pending label, disabled reasons, stock labels, and detail link labels.
- `app/features/buyer/components/ProfilePage.test.tsx`: asserts `Phone`, `Save`, phone code flow messages, and phone verification labels.
- `app/features/buyer/components/WishlistPage.test.tsx`: asserts wishlist empty/error text, add/remove aria labels, toast strings, and availability labels.
- `app/features/product/components/ProductBuyerStates.test.tsx`: may need updates if shared buyer state labels are adjusted.

## Suggested Migration Order

1. Normalize `messages/th.json` scoped namespaces first.
2. Add missing English/Thai keys for cart handoff, product card, marketplace home, product detail reviews/questions, profile, and wishlist.
3. Migrate shared helpers/components next: `cart-handoff.ts`, `ProductCard.tsx`, `BuyerShell.tsx` title defaults if needed.
4. Migrate large pages: `MarketplaceHome.tsx`, `ProductDetailPage.tsx`, `ProfilePage.tsx`, `WishlistPage.tsx`.
5. Update tests alongside each migrated component.
6. Add deterministic audit tooling with documented exceptions for API-provided catalog/user/order/notification data and test fixtures.

