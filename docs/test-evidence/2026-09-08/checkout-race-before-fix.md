# Checkout duplicate submission: pre-fix evidence

Production-mode local browser run, cache and rate limits enabled. Synthetic accounts, PostgreSQL fixtures and payment checkout configuration; no external charge was performed.

## Chromium

- User: `35bf7590-fad7-406c-ada8-d1f446053f3b`
- Cart: `33e05cd9-e44d-4d97-ad1d-d2441ceaa69a`
- Two successful checkout responses created distinct orders: `ac6f285d-99d8-4798-8807-c5bc54989c92` and `49aff070-300c-4dc8-89a9-232ff1260cdc`.
- PostgreSQL confirmed two orders and two payments. Inventory remained on-hand 10, but reserved quantity was 4 instead of 2.

## WebKit

- User: `7e45973a-6ab7-4b6e-a625-5287c778b04c`
- Cart: `b26fa725-800b-4bb3-8ffc-e6461cc14f30`
- First request created order `2bee5586-7fb5-4e8b-88b6-77fd9b85815b`; second request returned HTTP 400.
- One order, reserved quantity 2. The later failure overwrote the success state in the UI.

Playwright route fetching and browser observations can record the same request twice. Distinct response order IDs and database records, rather than raw trace entry counts, establish the Chromium defect.

Regression requirements: synchronous UI submit guard with retry after failure; backend serialization/revalidation of concurrent checkout for the same cart; exactly one order/payment and the intended reservation quantity. See the final acceptance ledger for post-fix execution results.
