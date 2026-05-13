# Frontend Accessibility

This document defines accessibility expectations for the marketplace UI.

## Baseline

- Follow WCAG 2.2 AA where practical.
- Use semantic HTML and shadcn/ui primitives correctly.
- Ensure all interactive elements are keyboard accessible.
- Maintain visible focus states.
- Do not rely on color alone for status.

## Navigation

- Bottom navigation items must have text labels or accessible labels.
- Current route should be indicated for assistive technologies.
- Search input should have a clear accessible name.
- Back buttons should identify destination or purpose.

## Forms

- Inputs must have labels.
- Validation errors should be associated with fields.
- Required fields should be communicated.
- Checkout errors should identify affected item/shop/section.

## Dialogs and Sheets

- Filter, variant, address, shipping, and coupon sheets must trap focus.
- Escape and close controls should work.
- Sheet title should describe the task.
- Sticky CTA inside sheets must remain keyboard reachable.

## Product Cards

- Product image alt text should use product title.
- Price and discount should be text, not image-only.
- Whole-card click targets must not hide secondary actions from keyboard users.

## Status and Feedback

- Payment pending/success/failure must use text labels.
- Order/shipment/refund statuses must be readable text.
- Toasts should not be the only place important errors are shown.
- Loading states should avoid layout shift.

## Mobile Requirements

- Tap targets at least 44px.
- Sticky CTA must not overlap content.
- Bottom nav must not trap focus or obscure form controls.
- Text must fit within buttons and cards.

## Testing Checklist

- Navigate primary flows with keyboard.
- Verify focus order in product detail, cart, checkout, and admin tables/cards.
- Verify dialogs/sheets trap and restore focus.
- Verify screen reader labels for search, filters, cart actions, and checkout CTA.
- Verify status labels are understandable without color.
