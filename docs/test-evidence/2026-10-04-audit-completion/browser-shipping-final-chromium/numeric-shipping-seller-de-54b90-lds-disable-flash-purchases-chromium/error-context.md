# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: numeric-shipping.spec.ts >> seller decimal shipping survives UI, quote and order; physical holds disable flash purchases
- Location: e2e\numeric-shipping.spec.ts:12:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('section').filter({ has: getByRole('heading', { name: 'Held-stock flash 00000000-51e8-4e3f-a8fa-9ba652349bb1', exact: true }) }).locator('article').filter({ hasText: 'Extended product 8221dc35' }).getByText('฿90.00', { exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('section').filter({ has: getByRole('heading', { name: 'Held-stock flash 00000000-51e8-4e3f-a8fa-9ba652349bb1', exact: true }) }).locator('article').filter({ hasText: 'Extended product 8221dc35' }).getByText('฿90.00', { exact: true })

```

```yaml
- banner:
  - link "Marketplace":
    - /url: /en
  - textbox "Search deals, brands, and shops"
  - link "Notifications":
    - /url: /en/notifications
  - link "Messages":
    - /url: /en/chat
  - link "Cart":
    - /url: /en/cart
  - link "Start selling":
    - /url: /en/seller/register
  - link "Seller chat":
    - /url: /en/seller/chat
  - link "Profile":
    - /url: /en/profile
  - button "Sign out"
  - paragraph: Welcome back, Extended E2E Buyer
  - link "ไทย":
    - /url: /th
  - link "EN":
    - /url: /en
- main:
  - link "E3FED3F4-F3EC-40B6-9EDB-C3DAC5E2E879 E3FED3F4-F3EC-40B6-9EDB-C3DAC5E2E879":
    - /url: /en/vouchers
    - paragraph: E3FED3F4-F3EC-40B6-9EDB-C3DAC5E2E879
    - paragraph: E3FED3F4-F3EC-40B6-9EDB-C3DAC5E2E879
  - link "B5AEF697-42A0-4DD8-93D8-900EF756B330 B5AEF697-42A0-4DD8-93D8-900EF756B330":
    - /url: /en/vouchers
    - paragraph: B5AEF697-42A0-4DD8-93D8-900EF756B330
    - paragraph: B5AEF697-42A0-4DD8-93D8-900EF756B330
  - link "C0AC809E-D2A2-4640-B77D-D7426385B600 C0AC809E-D2A2-4640-B77D-D7426385B600":
    - /url: /en/vouchers
    - paragraph: C0AC809E-D2A2-4640-B77D-D7426385B600
    - paragraph: C0AC809E-D2A2-4640-B77D-D7426385B600
  - heading "Held-stock flash 00000000-51e8-4e3f-a8fa-9ba652349bb1" [level=2]
  - paragraph: Ends 10/4/2026
  - article:
    - link "Extended product 8221dc35 Sale Save product":
      - /url: /en/products/c4333786-664e-44a8-a5bc-2d30e4d0fdb6
      - img "Extended product 8221dc35"
      - text: Sale Save product
    - paragraph: Extended product 8221dc35
    - paragraph: THB 90.00
    - paragraph: 0 sold
    - button "Add" [disabled]
  - heading "Categories" [level=2]
  - link "1d53d8f2-80fb-401b-9dc2-b1e945d6b5aa":
    - /url: /en/categories/1d53d8f2-80fb-401b-9dc2-b1e945d6b5aa
  - link "60789e30-baa8-4bba-a8b9-a120d93e929e":
    - /url: /en/categories/60789e30-baa8-4bba-a8b9-a120d93e929e
  - link "64eefab0-d60e-4fff-97d7-f93c0562fffa":
    - /url: /en/categories/64eefab0-d60e-4fff-97d7-f93c0562fffa
  - link "6577e3a4-7cd5-4380-8e56-1999a7eaeefc":
    - /url: /en/categories/6577e3a4-7cd5-4380-8e56-1999a7eaeefc
  - link "753ea258-99c3-47b3-955f-d8c4acb1f8ad":
    - /url: /en/categories/753ea258-99c3-47b3-955f-d8c4acb1f8ad
  - link "7bfc1669-8dde-473d-b04e-69509f7d025d":
    - /url: /en/categories/7bfc1669-8dde-473d-b04e-69509f7d025d
  - link "Numeric audit":
    - /url: /en/categories/numeric-audit
  - link "Projection-10cdaba3-4053-4901-874b-f00a11b7b80b":
    - /url: /en/categories/e3e7b482-56d8-40e6-bb61-a6d3837b63b4
  - link "Projection-5fa23eee-7fb5-437c-893d-cb66c291a635":
    - /url: /en/categories/de1f7fae-eec5-43c8-bb77-8427fa6a210b
  - link "Projection-d3734d40-a557-42be-9b18-fd143014e564":
    - /url: /en/categories/6171c9bb-e06b-4e98-b5b5-4f4bfce57191
  - heading "Recommended for you" [level=2]
  - paragraph: Fresh picks based on deals and shop momentum
  - article:
    - link "View Extended product 694cb13a":
      - /url: /en/products/c9b06d84-6e98-494a-abf1-ae1c7ef151a8
      - img "Extended product 694cb13a"
    - button "Add Extended product 694cb13a to wishlist"
    - link "Extended product 694cb13a":
      - /url: /en/products/c9b06d84-6e98-494a-abf1-ae1c7ef151a8
      - heading "Extended product 694cb13a" [level=3]
    - paragraph: ฿100.00
    - text: 6 sold 4.3 Extended Shop 71f3448b
    - button "Quick add Extended product 694cb13a to cart"
    - paragraph
  - article:
    - link "View Extended product 90b63ad5":
      - /url: /en/products/428fcd09-0ed5-4cf3-ab14-623ad5c173bf
      - img "Extended product 90b63ad5"
    - button "Add Extended product 90b63ad5 to wishlist"
    - link "Extended product 90b63ad5":
      - /url: /en/products/428fcd09-0ed5-4cf3-ab14-623ad5c173bf
      - heading "Extended product 90b63ad5" [level=3]
    - paragraph: ฿100.00
    - text: 6 sold 4.3 Extended Shop 22c63180
    - button "Quick add Extended product 90b63ad5 to cart"
    - paragraph
  - article:
    - link "View Extended product 52b08e45":
      - /url: /en/products/35c6401e-92e5-4eec-891a-a7cba4551fb1
      - img "Extended product 52b08e45"
    - button "Add Extended product 52b08e45 to wishlist"
    - link "Extended product 52b08e45":
      - /url: /en/products/35c6401e-92e5-4eec-891a-a7cba4551fb1
      - heading "Extended product 52b08e45" [level=3]
    - paragraph: ฿100.00
    - text: 6 sold 4.3 Extended Shop d2209f68
    - button "Quick add Extended product 52b08e45 to cart"
    - paragraph
  - article:
    - link "View Extended product c16732f9":
      - /url: /en/products/396596f5-cc3d-4ffc-bf73-eb5d2bbb5100
      - img "Extended product c16732f9"
    - button "Add Extended product c16732f9 to wishlist"
    - link "Extended product c16732f9":
      - /url: /en/products/396596f5-cc3d-4ffc-bf73-eb5d2bbb5100
      - heading "Extended product c16732f9" [level=3]
    - paragraph: ฿100.00
    - text: 6 sold 4.3 Extended Shop 75df54c9
    - button "Quick add Extended product c16732f9 to cart"
    - paragraph
  - article:
    - link "View Projection-2549098f-a711-4889-a5c6-916c44404c95 new100":
      - /url: /en/products/1c22e267-607c-4d80-8da7-e3ca54d188d9
      - img "Projection-2549098f-a711-4889-a5c6-916c44404c95 new100"
    - button "Add Projection-2549098f-a711-4889-a5c6-916c44404c95 new100 to wishlist"
    - link "Projection-2549098f-a711-4889-a5c6-916c44404c95 new100":
      - /url: /en/products/1c22e267-607c-4d80-8da7-e3ca54d188d9
      - heading "Projection-2549098f-a711-4889-a5c6-916c44404c95 new100" [level=3]
    - paragraph: ฿20.00
    - text: 100 sold 4.0 Extended Shop d274858c
    - button "Quick add Projection-2549098f-a711-4889-a5c6-916c44404c95 new100 to cart"
    - paragraph
  - article:
    - link "View Projection-10cdaba3-4053-4901-874b-f00a11b7b80b new100":
      - /url: /en/products/cadded07-dd0d-4ec8-b21c-ceaab96eb85b
      - img "Projection-10cdaba3-4053-4901-874b-f00a11b7b80b new100"
    - button "Add Projection-10cdaba3-4053-4901-874b-f00a11b7b80b new100 to wishlist"
    - link "Projection-10cdaba3-4053-4901-874b-f00a11b7b80b new100":
      - /url: /en/products/cadded07-dd0d-4ec8-b21c-ceaab96eb85b
      - heading "Projection-10cdaba3-4053-4901-874b-f00a11b7b80b new100" [level=3]
    - paragraph: ฿20.00
    - text: 100 sold 4.0 Extended Shop 1a5b5980
    - button "Quick add Projection-10cdaba3-4053-4901-874b-f00a11b7b80b new100 to cart"
    - paragraph
  - article:
    - link "View Projection-d3734d40-a557-42be-9b18-fd143014e564 new100":
      - /url: /en/products/befe1aab-1238-4ef5-9c43-a2d34e6efc8d
      - img "Projection-d3734d40-a557-42be-9b18-fd143014e564 new100"
    - button "Add Projection-d3734d40-a557-42be-9b18-fd143014e564 new100 to wishlist"
    - link "Projection-d3734d40-a557-42be-9b18-fd143014e564 new100":
      - /url: /en/products/befe1aab-1238-4ef5-9c43-a2d34e6efc8d
      - heading "Projection-d3734d40-a557-42be-9b18-fd143014e564 new100" [level=3]
    - paragraph: ฿20.00
    - text: 100 sold 4.0 Extended Shop d84e4721
    - button "Quick add Projection-d3734d40-a557-42be-9b18-fd143014e564 new100 to cart"
    - paragraph
  - article:
    - link "View Projection-2549098f-a711-4889-a5c6-916c44404c95 old99":
      - /url: /en/products/c82c2f5c-640a-4b76-8fb7-350794298ea9
      - img "Projection-2549098f-a711-4889-a5c6-916c44404c95 old99"
    - button "Add Projection-2549098f-a711-4889-a5c6-916c44404c95 old99 to wishlist"
    - link "Projection-2549098f-a711-4889-a5c6-916c44404c95 old99":
      - /url: /en/products/c82c2f5c-640a-4b76-8fb7-350794298ea9
      - heading "Projection-2549098f-a711-4889-a5c6-916c44404c95 old99" [level=3]
    - paragraph: ฿10.00
    - text: 99 sold 3.0 Extended Shop d274858c
    - button "Quick add Projection-2549098f-a711-4889-a5c6-916c44404c95 old99 to cart"
    - paragraph
  - text: Loading more deals...
  - heading "New arrivals" [level=2]
  - paragraph: Recently added products from active shops
  - article:
    - link "View Extended product 8221dc35":
      - /url: /en/products/c4333786-664e-44a8-a5bc-2d30e4d0fdb6
      - img "Extended product 8221dc35"
    - text: New
    - button "Add Extended product 8221dc35 to wishlist"
    - text: Out of stock
    - link "Extended product 8221dc35":
      - /url: /en/products/c4333786-664e-44a8-a5bc-2d30e4d0fdb6
      - heading "Extended product 8221dc35" [level=3]
    - paragraph: ฿100.00
    - text: Unavailable 0.0 Extended Shop ab1cdfbd
    - link "Open Extended product 8221dc35 details":
      - /url: /en/products/c4333786-664e-44a8-a5bc-2d30e4d0fdb6
      - text: Details
    - paragraph
  - article:
    - link "View Extended product 448790b2":
      - /url: /en/products/b1e32ccb-f0fc-4c9a-b42d-fe2f53c06cd1
      - img "Extended product 448790b2"
    - text: New
    - button "Add Extended product 448790b2 to wishlist"
    - link "Extended product 448790b2":
      - /url: /en/products/b1e32ccb-f0fc-4c9a-b42d-fe2f53c06cd1
      - heading "Extended product 448790b2" [level=3]
    - paragraph: ฿100.00
    - text: 0 sold 0.0 Extended Shop 040e95c3
    - button "Quick add Extended product 448790b2 to cart"
    - paragraph
  - article:
    - link "View Extended product 5a8cb2ec":
      - /url: /en/products/82381f1a-e15c-4ac1-95d4-ccd2b6d984d3
      - img "Extended product 5a8cb2ec"
    - text: New
    - button "Add Extended product 5a8cb2ec to wishlist"
    - link "Extended product 5a8cb2ec":
      - /url: /en/products/82381f1a-e15c-4ac1-95d4-ccd2b6d984d3
      - heading "Extended product 5a8cb2ec" [level=3]
    - paragraph: ฿100.00
    - text: 1 sold 0.0 Extended Shop 51dc5322
    - button "Quick add Extended product 5a8cb2ec to cart"
    - paragraph
  - article:
    - link "View Finance item 6000":
      - /url: /en/products/3d8b96d0-5b6b-4700-8449-4fefc0e872bb
      - img "Finance item 6000"
    - text: New
    - button "Add Finance item 6000 to wishlist"
    - text: Out of stock
    - link "Finance item 6000":
      - /url: /en/products/3d8b96d0-5b6b-4700-8449-4fefc0e872bb
      - heading "Finance item 6000" [level=3]
    - paragraph: ฿60.00
    - text: Unavailable 0.0 Finance c1938e43-b319-4bfd-89f2-73e8dc5c26c0
    - link "Open Finance item 6000 details":
      - /url: /en/products/3d8b96d0-5b6b-4700-8449-4fefc0e872bb
      - text: Details
    - paragraph
  - article:
    - link "View Finance item 4000":
      - /url: /en/products/2403d66c-526f-4133-93cb-feb167e739ae
      - img "Finance item 4000"
    - text: New
    - button "Add Finance item 4000 to wishlist"
    - text: Out of stock
    - link "Finance item 4000":
      - /url: /en/products/2403d66c-526f-4133-93cb-feb167e739ae
      - heading "Finance item 4000" [level=3]
    - paragraph: ฿40.00
    - text: Unavailable 0.0 Finance c1938e43-b319-4bfd-89f2-73e8dc5c26c0
    - link "Open Finance item 4000 details":
      - /url: /en/products/2403d66c-526f-4133-93cb-feb167e739ae
      - text: Details
    - paragraph
  - article:
    - link "View Extended product 7d670b81":
      - /url: /en/products/5436013d-90b1-48b9-ba78-b576b4e1344c
      - img "Extended product 7d670b81"
    - text: New
    - button "Add Extended product 7d670b81 to wishlist"
    - link "Extended product 7d670b81":
      - /url: /en/products/5436013d-90b1-48b9-ba78-b576b4e1344c
      - heading "Extended product 7d670b81" [level=3]
    - paragraph: ฿107.00
    - text: 1 sold 0.0 Extended Shop 1590e51e
    - button "Quick add Extended product 7d670b81 to cart"
    - paragraph
  - article:
    - link "View Finance item 6000":
      - /url: /en/products/962aea4f-6d74-4e42-8272-6f81028e8cb5
      - img "Finance item 6000"
    - text: New
    - button "Add Finance item 6000 to wishlist"
    - text: Out of stock
    - link "Finance item 6000":
      - /url: /en/products/962aea4f-6d74-4e42-8272-6f81028e8cb5
      - heading "Finance item 6000" [level=3]
    - paragraph: ฿60.00
    - text: Unavailable 0.0 Finance e12ea2a5-d606-45fe-9b4b-b058829f3712
    - link "Open Finance item 6000 details":
      - /url: /en/products/962aea4f-6d74-4e42-8272-6f81028e8cb5
      - text: Details
    - paragraph
  - article:
    - link "View Finance item 4000":
      - /url: /en/products/67e9f555-9f53-44c7-940b-6de7b2903272
      - img "Finance item 4000"
    - text: New
    - button "Add Finance item 4000 to wishlist"
    - text: Out of stock
    - link "Finance item 4000":
      - /url: /en/products/67e9f555-9f53-44c7-940b-6de7b2903272
      - heading "Finance item 4000" [level=3]
    - paragraph: ฿40.00
    - text: Unavailable 0.0 Finance e12ea2a5-d606-45fe-9b4b-b058829f3712
    - link "Open Finance item 4000 details":
      - /url: /en/products/67e9f555-9f53-44c7-940b-6de7b2903272
      - text: Details
    - paragraph
  - article:
    - link "View Extended product aa823a95":
      - /url: /en/products/2b608f68-2e84-4992-895b-7ee593640761
      - img "Extended product aa823a95"
    - text: New
    - button "Add Extended product aa823a95 to wishlist"
    - link "Extended product aa823a95":
      - /url: /en/products/2b608f68-2e84-4992-895b-7ee593640761
      - heading "Extended product aa823a95" [level=3]
    - paragraph: ฿100.00
    - text: 0 sold 0.0 Extended Shop 362383fb
    - button "Quick add Extended product aa823a95 to cart"
    - paragraph
  - article:
    - link "View Extended product dde7f0f8":
      - /url: /en/products/afb94e08-ebf7-4595-8761-29722dbaf195
      - img "Extended product dde7f0f8"
    - text: New
    - button "Add Extended product dde7f0f8 to wishlist"
    - link "Extended product dde7f0f8":
      - /url: /en/products/afb94e08-ebf7-4595-8761-29722dbaf195
      - heading "Extended product dde7f0f8" [level=3]
    - paragraph: ฿100.00
    - text: 5 sold 0.0 Extended Shop 9d20e4a4
    - button "Quick add Extended product dde7f0f8 to cart"
    - paragraph
  - article:
    - link "View Projection-532d1bee-2eb5-4bc8-91cc-8a51c345cf33 source1000":
      - /url: /en/products/2d3eb56c-ac56-4455-bb25-219d32da74c4
      - img "Projection-532d1bee-2eb5-4bc8-91cc-8a51c345cf33 source1000"
    - text: New
    - button "Add Projection-532d1bee-2eb5-4bc8-91cc-8a51c345cf33 source1000 to wishlist"
    - link "Projection-532d1bee-2eb5-4bc8-91cc-8a51c345cf33 source1000":
      - /url: /en/products/2d3eb56c-ac56-4455-bb25-219d32da74c4
      - heading "Projection-532d1bee-2eb5-4bc8-91cc-8a51c345cf33 source1000" [level=3]
    - paragraph: ฿10.00
    - text: 0 sold 0.0 Extended Shop b2710d7f
    - button "Quick add Projection-532d1bee-2eb5-4bc8-91cc-8a51c345cf33 source1000 to cart"
    - paragraph
  - article:
    - link "View Projection-2549098f-a711-4889-a5c6-916c44404c95 fully-reserved":
      - /url: /en/products/52776282-eb12-41f5-b4de-c8b122042d2f
      - img "Projection-2549098f-a711-4889-a5c6-916c44404c95 fully-reserved"
    - text: New
    - button "Add Projection-2549098f-a711-4889-a5c6-916c44404c95 fully-reserved to wishlist"
    - text: Out of stock
    - link "Projection-2549098f-a711-4889-a5c6-916c44404c95 fully-reserved":
      - /url: /en/products/52776282-eb12-41f5-b4de-c8b122042d2f
      - heading "Projection-2549098f-a711-4889-a5c6-916c44404c95 fully-reserved" [level=3]
    - paragraph: ฿5.00
    - text: Unavailable 0.0 Extended Shop d274858c
    - link "Open Projection-2549098f-a711-4889-a5c6-916c44404c95 fully-reserved details":
      - /url: /en/products/52776282-eb12-41f5-b4de-c8b122042d2f
      - text: Details
    - paragraph
  - text: You're all caught up
  - heading "Featured shops" [level=2]
  - link "Extended Shop 71f3448b 0 products · 0 followers 4.7 (3)":
    - /url: /en/shops/d6641666-bda2-4b24-ac62-893b59a31219
    - paragraph: Extended Shop 71f3448b
    - paragraph: 0 products · 0 followers
    - paragraph: 4.7 (3)
  - link "Extended Shop 22c63180 0 products · 0 followers 4.7 (3)":
    - /url: /en/shops/95e0bdaf-db5a-44e6-83bf-6e4f0a7a65ef
    - paragraph: Extended Shop 22c63180
    - paragraph: 0 products · 0 followers
    - paragraph: 4.7 (3)
  - link "Extended Shop d2209f68 0 products · 0 followers 4.7 (3)":
    - /url: /en/shops/835a1de9-2bef-4a10-88d1-3f86f57ee169
    - paragraph: Extended Shop d2209f68
    - paragraph: 0 products · 0 followers
    - paragraph: 4.7 (3)
  - link "Extended Shop 75df54c9 0 products · 0 followers 4.7 (3)":
    - /url: /en/shops/58aeb3ab-773b-4529-8ec0-bd37e059bb2f
    - paragraph: Extended Shop 75df54c9
    - paragraph: 0 products · 0 followers
    - paragraph: 4.7 (3)
  - link "Extended Shop ab1cdfbd 0 products · 0 followers 0.0 (0)":
    - /url: /en/shops/4b8382ce-efb8-4aa2-9cda-4917511e1085
    - paragraph: Extended Shop ab1cdfbd
    - paragraph: 0 products · 0 followers
    - paragraph: 0.0 (0)
  - link "Extended Shop 040e95c3 0 products · 0 followers 0.0 (0)":
    - /url: /en/shops/31da5b13-abc7-42d7-96f3-3cf02fc54653
    - paragraph: Extended Shop 040e95c3
    - paragraph: 0 products · 0 followers
    - paragraph: 0.0 (0)
  - link "Extended Shop 51dc5322 0 products · 0 followers 0.0 (0)":
    - /url: /en/shops/2224241f-8965-45a1-b231-68b9079841b9
    - paragraph: Extended Shop 51dc5322
    - paragraph: 0 products · 0 followers
    - paragraph: 0.0 (0)
  - link "Finance c1938e43-b319-4bfd-89f2-73e8dc5c26c0 0 products · 0 followers 0.0 (0)":
    - /url: /en/shops/finance-c1938e43-b319-4bfd-89f2-73e8dc5c26c0
    - paragraph: Finance c1938e43-b319-4bfd-89f2-73e8dc5c26c0
    - paragraph: 0 products · 0 followers
    - paragraph: 0.0 (0)
  - heading "Recently viewed" [level=2]
  - paragraph: Products from your latest browsing activity
  - paragraph: No recently viewed products
  - paragraph: Products you open will be shown here for quick access.
  - text: You're all caught up
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import { prisma } from '#server/lib/prisma.ts';
  3   | import en from '../messages/en.json' with { type: 'json' };
  4   | import { isolateActorPage, newActorContext } from './helpers/browser-context';
  5   | import { commerceFixture, loginUi, placeOrderUi } from './helpers/commerce-fixtures';
  6   | 
  7   | test.use({ storageState: { cookies: [], origins: [] } });
  8   | test.setTimeout(120_000);
  9   | test.beforeEach(async ({ page }) => { await isolateActorPage(page); });
  10  | test.afterAll(async () => { await prisma.$disconnect(); });
  11  | 
  12  | test('seller decimal shipping survives UI, quote and order; physical holds disable flash purchases', async ({ page, browser, baseURL }, testInfo) => {
  13  |   const fixture = await commerceFixture();
  14  |   const { seller, shop, product, variant } = fixture.shops[0]!;
  15  |   await prisma.shopSetting.create({ data: { shopId: shop.id, shippingFee: 0n } });
  16  |   await loginUi(page, seller, '/en/seller/shop');
  17  |   const shippingInput = page.getByLabel(en.seller.manage.shippingFeeBaht, { exact: true });
  18  |   await expect(shippingInput).toHaveValue('0');
  19  |   await shippingInput.fill('49.95');
  20  |   const settingsPath = `/api/seller/shops/${shop.id}/settings`;
  21  |   const savedResponse = page.waitForResponse(response => new URL(response.url()).pathname === settingsPath && response.request().method() === 'PATCH');
  22  |   await page.getByRole('button', { name: en.seller.manage.saveShippingFee, exact: true }).click();
  23  |   const saved = await savedResponse;
  24  |   expect(saved.request().postDataJSON()).toMatchObject({ shippingFeeBaht: '49.95' });
  25  |   expect(saved.ok(), await saved.text()).toBeTruthy();
  26  |   expect(await saved.json()).toMatchObject({ shopId: shop.id, shippingFeeBaht: 49.95 });
  27  |   expect(await prisma.shopSetting.findUniqueOrThrow({ where: { shopId: shop.id } })).toMatchObject({ shippingFee: 4995n });
  28  |   await expect(page.getByText(en.seller.manage.shippingFeeSaved, { exact: true })).toBeVisible();
  29  | 
  30  |   const invalid = await page.request.patch(settingsPath, { data: { shippingFeeBaht: '49.951' } });
  31  |   expect(invalid.status()).toBe(422);
  32  |   expect(await prisma.shopSetting.findUniqueOrThrow({ where: { shopId: shop.id } })).toMatchObject({ shippingFee: 4995n });
  33  |   const settings = await page.request.get(settingsPath);
  34  |   expect(settings.ok(), await settings.text()).toBeTruthy();
  35  |   expect(await settings.json()).toMatchObject({ shippingFeeBaht: 49.95 });
  36  |   await page.reload();
  37  |   await expect(shippingInput).toHaveValue('49.95');
  38  | 
  39  |   const cart = await prisma.cart.create({ data: { userId: fixture.buyer.id,
  40  |     items: { create: { variantId: variant.id, quantity: 10, unitPrice: 10000n } },
  41  |   }, include: { items: true } });
  42  |   const buyerContext = await newActorContext(browser, { baseURL });
  43  |   let flashSaleId: string | undefined;
  44  |   try {
  45  |     const buyerPage = await buyerContext.newPage();
  46  |     await loginUi(buyerPage, fixture.buyer, '/en/checkout');
  47  |     await expect(buyerPage.getByRole('button', { name: en.checkout.placeOrder, exact: true })).toBeEnabled();
  48  |     await expect(buyerPage.getByText('฿49.95', { exact: true })).toBeVisible();
  49  |     await expect(buyerPage.getByText('฿1,049.95', { exact: true })).toHaveCount(2);
  50  |     const quoteResponse = await buyerPage.request.post('/api/checkout/quote', { data: {
  51  |       cartId: cart.id, cartItemIds: cart.items.map(item => item.id),
  52  |     } });
  53  |     expect(quoteResponse.ok(), await quoteResponse.text()).toBeTruthy();
  54  |     expect(await quoteResponse.json()).toMatchObject({
  55  |       subtotal: '100000', discountTotal: '0', shippingTotal: '4995', taxTotal: '0', grandTotal: '104995',
  56  |       shops: [expect.objectContaining({ shopId: shop.id, subtotal: '100000' })],
  57  |     });
  58  |     const screenshot = testInfo.outputPath('shipping-49-95-checkout.png');
  59  |     await buyerPage.screenshot({ path: screenshot, fullPage: true });
  60  |     await testInfo.attach('exact-shipping-checkout', { path: screenshot, contentType: 'image/png' });
  61  |     const result = await placeOrderUi(buyerPage);
  62  |     expect(result.totalCents).toBe('104995');
  63  |     expect(await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } })).toMatchObject({
  64  |       subtotal: 100000n, shippingTotal: 4995n, grandTotal: 104995n,
  65  |     });
  66  |     expect(await prisma.shopOrder.findFirstOrThrow({ where: { orderId: result.orderId, shopId: shop.id } })).toMatchObject({
  67  |       shippingTotal: 4995n, grandTotal: 104995n,
  68  |     });
  69  |     expect(await prisma.shopSaleSnapshot.findFirstOrThrow({ where: { shopOrder: { orderId: result.orderId, shopId: shop.id } } })).toMatchObject({
  70  |       originalShipping: 4995n, buyerShipping: 4995n,
  71  |     });
  72  |     expect(await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } })).toMatchObject({ amount: 104995n, status: 'PENDING' });
  73  |     expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 10 });
  74  | 
  75  |     const campaign = await prisma.flashSale.create({ data: {
  76  |       title: `Held-stock flash ${shop.id}`, status: 'ACTIVE',
  77  |       startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 120_000),
  78  |       items: { create: { shopId: shop.id, productId: product.id, variantId: variant.id,
  79  |         salePrice: 9000n, originalPrice: 10000n, stockLimit: 20, soldCount: 0, perUserLimit: 10,
  80  |       } },
  81  |     }, include: { items: true } });
  82  |     flashSaleId = campaign.id;
  83  |     const discovery = await buyerPage.request.get('/api/discovery/home?locale=en');
  84  |     expect(discovery.ok(), await discovery.text()).toBeTruthy();
  85  |     expect(await discovery.json()).toMatchObject({ sections: { flashSale: {
  86  |       id: campaign.id, items: [expect.objectContaining({ id: campaign.items[0]!.id,
  87  |         salePrice: '9000', originalPrice: '10000', stockLimit: 20, soldCount: 0, availableStock: 0,
  88  |       })],
  89  |     } } });
  90  |     expect(await prisma.flashSaleReservation.count({ where: { flashSaleItemId: campaign.items[0]!.id } })).toBe(0);
  91  |     await buyerPage.goto('/en');
  92  |     const section = buyerPage.locator('section').filter({ has: buyerPage.getByRole('heading', { name: campaign.title, exact: true }) });
  93  |     const card = section.locator('article').filter({ hasText: product.title });
  94  |     await expect(card).toHaveCount(1);
> 95  |     await expect(card.getByText('฿90.00', { exact: true })).toBeVisible();
      |                                                             ^ Error: expect(locator).toBeVisible() failed
  96  |     await expect(card.getByRole('button', { name: en.product.add, exact: true })).toBeDisabled();
  97  |     const heldScreenshot = testInfo.outputPath('flash-physical-stock-held.png');
  98  |     await section.screenshot({ path: heldScreenshot });
  99  |     await testInfo.attach('flash-physical-stock-held', { path: heldScreenshot, contentType: 'image/png' });
  100 |   } finally {
  101 |     if (flashSaleId) await prisma.flashSale.update({ where: { id: flashSaleId }, data: { status: 'ENDED' } });
  102 |     await buyerContext.close();
  103 |   }
  104 | });
  105 | 
```