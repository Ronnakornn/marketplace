# Handoff Error Recovery Accessibility

## Goal

Ensure add-to-cart handoff states are recoverable and accessible when auth, stock, variant, or network conditions prevent a successful cart update.

## In Scope

- Login-required path for anonymous buyers.
- Missing variant or out-of-stock disabled reasons.
- Network/API error state with retry or clear next step.
- Cart count refresh after successful mutation.
- Accessible labels and focus behavior for confirmation actions.
- Tests for success, pending, error, and disabled states.

## Out of Scope

- Full site accessibility audit.
- Cart inventory conflict resolution redesign.
- Checkout validation redesign.

## Constraints

- No visible `[object Object]` messages.
- Error messages must not overflow mobile action bars/cards.
- Pending states must not cause layout shift.
