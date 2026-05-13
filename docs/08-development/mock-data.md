# Mock and Seed Data Guide

This document defines development data needed to build and test the marketplace.

## Goals

- Provide realistic marketplace UI data.
- Support repeatable backend and frontend testing.
- Cover multi-vendor checkout, split shipments, payment states, and admin exceptions.

## Required Users

- Guest: no persisted user needed.
- Buyer: `buyer@example.com`
- Seller A: `seller-a@example.com`
- Seller B: `seller-b@example.com`
- Admin: from `ADMIN_EMAILS`

## Required Shops

Shop A:
- active
- verified
- multiple products

Shop B:
- active
- verified
- multiple products

Shop Suspended:
- suspended
- products should not be publicly buyable

## Required Catalog Data

Categories:
- Electronics
- Fashion
- Beauty
- Home
- Toys
- Sports
- Groceries
- Automotive

Products:
- active product with one variant
- active product with multiple variants
- flash sale product
- free shipping product
- low-stock product
- out-of-stock product
- archived product
- rejected product

Inventory:
- enough stock
- low stock
- zero stock
- reserved stock

## Required Cart Scenarios

- Empty cart.
- Cart with one shop.
- Cart with two shops.
- Cart item out of stock.
- Cart item quantity exceeds stock.
- Cart item product removed.
- Cart item shop suspended.

## Required Checkout Scenarios

- Valid checkout with two shops.
- Missing address.
- Shipping unavailable for one shop.
- Coupon valid.
- Coupon expired.
- Reservation failure.
- Price changed.
- Reservation expired.

## Required Payment Scenarios

- Payment pending.
- Payment succeeded by webhook.
- Payment failed by webhook.
- Duplicate webhook event.
- Invalid webhook signature.
- Buyer returns before webhook arrives.

## Required Fulfillment Scenarios

- Order paid with shipments for two shops.
- One shipment ready, one shipped.
- One shipment delivered, one pending.
- Tracking number missing.
- Shipping provider delivered event.

## Required Return/Refund Scenarios

- Eligible delivered item.
- Ineligible pending item.
- Return requested.
- Return approved.
- Return rejected.
- Refund pending.
- Refund succeeded.

## Required Admin Scenarios

- Pending shop approval.
- Suspended shop.
- Flagged product.
- Payment exception.
- Shipment delayed.
- Refund escalation.
- Customer user.
- System user.

## Frontend Mock Rules

- Mock-only fields may be used for UI demonstration: rating, sold count, discount percent, free shipping badge, image gradient.
- Mock data must not imply trusted pricing or stock for checkout.
- UI fallback mocks should be clearly isolated from production data fetching.

## Acceptance Checklist

- Mock data supports every MVP page.
- Multi-shop order scenarios exist.
- Payment webhook scenarios exist.
- Seller and admin exception scenarios exist.
- Seed data can be regenerated predictably.
