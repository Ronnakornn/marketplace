# Read and delivery bounds

## Collection reads

`GET /api/me/favorites` and `GET /api/me/followed-shops` accept `page` and
`limit`. Their defaults are page 1 and 20 rows, with a maximum limit of 50.
Responses contain `items`, `page` and `hasMore`. The authenticated user controls
the ownership predicate. Both pages expose explicit load-more controls.
Offset pages are reconciled after favorite mutations because additions and
removals can shift later pages.

Wishlist reads select one earliest active fallback variant and one earliest
active available variant through two bounded bulk projections. Availability
compares on-hand with reserved inventory in PostgreSQL. Followed shops keep four
product previews with one price variant each. Money retains the existing exact
minor-unit DTO contract.

Product question pages contain at most three published answers per question,
the published `answerCount` and `answersCursor`. Public
`GET /api/products/questions/:questionId/answers` accepts that cursor and a
limit of at most 20. It returns `items` and `nextCursor`. Preview and continuation
use ascending creation time plus ID. Hidden questions and inactive products or
shops are excluded. Buyer and seller screens can load all remaining published
answers. Invalid cursors are rejected before database reads.

`GET /api/admin/settings` returns searchable metadata pages with the existing
admin pagination envelope. It omits JSON values. `GET /api/admin/settings/:key`
loads one complete setting for editing and requires `settings.read`. Writes
retain `settings.write` and their existing managed-setting policies. Search
matches literal key or description text. Checkout tax policy reads its specific
key directly and defaults only when that setting is absent.

## Avoiding repeated work

Visible product impressions are sent to `POST /api/discovery/impressions` in
batches of at most 50 events and 24 KiB of UTF-8 JSON, including the wrapper.
Each event retains its observed timestamp, source, position, session and
referrer. The server normalizes every event, bulk-loads unique active products,
validates each shop association and inserts all event facts together. Invalid
batches write nothing; UUID matching is case-insensitive. Other tracking event
types retain the single-event endpoint.

The shared public rate bucket charges each impression rather than only each
batch request. Client chunks share a 48 KiB keepalive budget per flush; later
chunks use ordinary fetch. Individually oversized or invalid observations are
dropped. Beacon/fetch and unmount delivery remain best effort, with no durable
replay or exactly-once guarantee. Existing per-mount visible-product deduplication
and debounce remain.

Discovery loads trending and newest products once each. The independent public
home-feed contract retains its other sections. Favorite-status batches retain
membership while product pages append and request only new IDs. Account changes
reset membership; disjoint results release old observers. Mutations reconcile
the account-scoped status and wishlist keys once per resource.

Seller inventory, shipments, returns, coupons and payouts commit trimmed search
text after 300 ms. Search and its page-one reset commit together. Filter/sort
links use the existing locale path helper.

Payment webhook settlement keeps financial writes, verification, idempotency
and stock changes inside the database transaction. Cache invalidation starts
only after commit. A failed transaction never invalidates committed-state
caches. Cache transport errors retain the existing fail-open behavior.

## Process-local event and socket limits

EventBus defaults to a 24-hour successful-handler replay horizon, 100,000 ledger
slots including pending handlers, and 256 active publications/handlers. These
limits and a monotonic clock are injectable through `EventBusOptions`. Pending
duplicates share work; failed handlers can retry. Capacity rejects new work
before execution and never evicts an unexpired replay key. Critical and
noncritical failures retain their existing error contracts. Replay after expiry
or restart can repeat a notification. Financial idempotency remains durable in
the business services and database; this ledger does not provide durable event
delivery.

Recurring schedulers inherit `removeOnComplete: 1000`, matching the queue
producer's success retention. Failure retention is unchanged.

WebSocket admission allows 20 commands per connection and 60 per user in each
10-second window. In-flight limits are two per connection, eight per user and
256 per process. Each connection permits 32 subscriptions. Rejected commands
produce `REALTIME_RATE_LIMITED` before session/ownership queries. Session and
ownership checks remain fresh. User budgets survive reconnects, expire when
idle, and have a 10,000-user cap. A socket with more than 64 queued deliveries
is closed; client recovery remains enabled. Limits are local to one API process.

## Enabled Web Push

Each PushService admits four fan-outs with two workers and ten devices each,
bounding active HTTPS requests to eight. Overload is logged and returns zero
deliveries under the existing best-effort policy. Notification rows remain the
source of truth. Every transport has an absolute 10-second destruction deadline
and a 64 KiB response limit. This is a transport bound, not a deadline for the
complete business request. Web Push signing/encryption still uses the installed
library. HTTP 404/410 cleanup remains active.

Device registration serializes on the user's row and permits ten devices.
Existing devices can renew at quota; new devices receive HTTP 409 with
`PUSH_SUBSCRIPTION_LIMIT_REACHED`. Valid devices are not evicted. Legacy accounts
above quota retain their rows and may renew or unsubscribe, while delivery
selects their ten most recently updated devices. Expiry and stale-endpoint
cleanup can shrink that registry. Push enablement in deployment is unchanged.
