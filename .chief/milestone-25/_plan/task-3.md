# Task 3: Normalize High-Impact Buyer Visual Consistency

## Objective

Normalize the most visible existing buyer page patterns across profile, cart, and checkout without redesigning the app.

## Required Changes

- Align obvious card and section treatment where inconsistency is visible and low risk.
- Improve helper/secondary text contrast on touched buyer pages.
- Keep existing orange primary actions and buyer shell navigation behavior.
- Keep mobile sticky cart/checkout footer behavior unchanged except readability class adjustments.

## Constraints

- No layout rewrite.
- No checkout behavior changes.
- No cart quantity or pricing logic changes.
- No new component abstraction unless it removes immediate duplication with very low risk.

## Verification

- Inspect diff for class-only or guard-only changes.
- Confirm no data-fetching or mutation behavior changes.
