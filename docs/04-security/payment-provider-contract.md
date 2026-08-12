# Payment Provider Contract

Production uses an external gateway bridge selected by `PAYMENT_PROVIDER`. The browser never decides the provider and cannot mark a payment successful.

## Checkout redirect

`PAYMENT_CHECKOUT_BASE_URL` receives these query parameters:

- `provider`, `paymentId`, `orderId`, `amount`, `currency`
- `expiresAt`, `issuedAt`, `locale`
- `signature`

The signature is lowercase HMAC-SHA256 using `PAYMENT_CHECKOUT_SECRET`. The signed payload sorts all fields except `signature` by key and joins `key=value` rows with a newline. The bridge must reject invalid signatures, expired checkout timestamps, replayed intents, mismatched amounts, and unsupported currencies.

## Normalized webhook

The bridge sends `POST /api/payments/webhook` with:

```json
{
  "provider": "configured-provider",
  "providerRef": "unique-provider-event-id",
  "eventType": "payment.paid",
  "paymentId": "uuid",
  "orderId": "uuid",
  "amount": 10000
}
```

Allowed events are `payment.paid`, `payment.failed`, and `payment.expired`. The bridge sets:

- `x-payment-timestamp`: Unix seconds
- `x-payment-signature`: HMAC-SHA256 of `<timestamp>.<stable-json-body>` using `PAYMENT_WEBHOOK_SECRET`

The API rejects timestamps outside five minutes, wrong provider/amount/order relationships, invalid state transitions, and duplicate `providerRef` values.

## Provider operations

- Keep the provider event ID immutable and globally unique.
- Retry non-2xx responses with exponential backoff.
- Reconcile provider settlements against successful local payments daily.
- Never translate client callbacks directly; verify them with the provider first.
