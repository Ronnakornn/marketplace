# Manual Finance and Fulfillment Operations

Refunds, payouts, and carrier delivery updates are currently operator-driven workflows. Production startup requires `MANUAL_FINANCE_OPERATIONS_ACKNOWLEDGED=true` so this operating mode cannot be enabled accidentally.

## Controls

- Restrict actions to named admin/seller accounts with MFA at the identity provider.
- Payouts are code-enforced as `requested -> approved -> paid`: approval records the approving admin; paid confirmation requires a different admin and a non-empty bank transfer reference.
- Refunds are code-enforced as `PENDING -> PROCESSING -> SUCCESS`: processing records the first admin; successful completion requires a different admin and a non-empty payment-provider reference.
- Admin delivery override requires a non-empty trusted carrier event or proof reference. Never use a buyer message alone as evidence.
- Keep provider, bank, and carrier evidence in the external system of record and use the same reference in the marketplace action.
- Never advance a refund to `SUCCESS` until the payment provider confirms settlement.
- Review `PAYOUT_STATUS_CHANGED`, `REFUND_STATUS_CHANGED`, and `SHIPMENT_STATUS_CHANGED` audit logs daily.

MFA, provider settlement, bank execution, carrier verification, and reconciliation remain operational controls outside this repository. The production acknowledgement confirms that those controls are active; it does not replace them.

## Daily reconciliation

1. Export provider settlements, refunds, bank transfers, and carrier exceptions.
2. Match external references to `paymentId`, `refundId`, `payoutId`, or `shipmentId`.
3. Investigate missing, duplicated, amount-mismatched, or terminal-state-conflicting rows.
4. Record resolution, operator, approver, timestamp, and external evidence reference.
5. Escalate unresolved money movement before the next payout window.

## Incident rule

If reconciliation cannot establish the authoritative state, leave the marketplace record pending, pause the affected operation, and escalate. Do not guess a successful financial state.
