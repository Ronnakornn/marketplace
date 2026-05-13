# Frontend Design System

This document defines visual and interaction rules for the mobile-first marketplace UI.

## Principles

- Mobile-first and conversion-focused.
- Clean, fast, and dense enough for ecommerce browsing.
- Use shadcn/ui primitives and Tailwind utilities.
- Keep layouts practical, not decorative.
- Avoid oversized marketing-style hero sections on marketplace screens.

## Layout

- Mobile baseline: 360px and 430px.
- Product grids: two columns on mobile.
- Cards: 8px radius or less unless inherited from shadcn/ui.
- Fixed bottom UI must include safe-area padding.
- Page content must include bottom padding when using bottom nav or sticky CTA.

## Typography

- Use compact hierarchy for operational UI.
- Product titles max two lines in cards.
- Do not scale font sizes with viewport width.
- Avoid negative letter spacing.
- Price text should be prominent but not overflow.

## Color and Status

Status colors:
- neutral: draft, pending, disabled
- success: paid, delivered, approved
- warning: low stock, pending payment, reservation expiring
- danger: failed, canceled, rejected, out of stock

Rules:
- Status badges must use consistent colors across buyer, seller, and admin.
- Do not rely on color alone; include text labels.

## Components

Use shadcn/ui for:
- Button
- Card
- Badge
- Input
- Sheet
- Dialog
- Tabs
- Table
- Skeleton
- Checkbox
- RadioGroup
- Select
- Tooltip
- Sonner/toast

Marketplace-specific components are documented in `components.md`.

## Mobile Interactions

- Bottom navigation for buyer primary routes.
- Sticky buy bar on product detail.
- Sticky checkout bar on cart and checkout.
- Bottom sheets for filters, variants, shipping, coupons, and address selection.
- Tap targets at least 44px.
- Skeletons must match final layout dimensions.

## Product Card Rules

Required:
- fixed image aspect ratio
- discount/campaign badge when relevant
- title max two lines
- price in integer cents formatted as currency
- rating/sold count
- shop/free shipping signal

Do not:
- show long descriptions
- let title or price overflow
- change card height dramatically between loading and loaded states

## Admin/Seller UI Rules

- Favor dense but scannable layouts.
- Use tables on desktop and cards on mobile.
- Keep primary action visible.
- Highlight exceptions before generic metrics.

## Accessibility

- Use semantic buttons and links.
- Preserve keyboard focus indicators.
- Dialogs and sheets must trap focus.
- Status updates should be readable by assistive tech where implementation supports it.
