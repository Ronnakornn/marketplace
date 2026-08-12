# Manual Finance and Fulfillment Operations

Refunds, payouts, and carrier delivery updates are currently operator-driven workflows. Production startup requires `MANUAL_FINANCE_OPERATIONS_ACKNOWLEDGED=true` so this operating mode cannot be enabled accidentally.

## Controls

- Restrict actions to named admin/seller accounts with MFA at the identity provider.
- Require a provider/bank/carrier reference in the external case record before changing local state.
- Use two-person approval for payout approval and paid confirmation.
- Never mark a refund successful until the payment provider confirms settlement.
- Never mark a shipment delivered from a buyer message alone; use carrier evidence.
- Review `PAYOUT_STATUS_CHANGED`, `REFUND_STATUS_CHANGED`, and `SHIPMENT_STATUS_CHANGED` audit logs daily.

## Daily reconciliation

1. Export provider settlements, refunds, bank transfers, and carrier exceptions.
2. Match external references to `paymentId`, `refundId`, `payoutId`, or `shipmentId`.
3. Investigate missing, duplicated, amount-mismatched, or terminal-state-conflicting rows.
4. Record resolution, operator, approver, timestamp, and external evidence reference.
5. Escalate unresolved money movement before the next payout window.

## Incident rule

If reconciliation cannot establish the authoritative state, leave the marketplace record pending, pause the affected operation, and escalate. Do not guess a successful financial state.
