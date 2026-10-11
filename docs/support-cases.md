# Support tickets and return appeals

The support module owns `SupportTicket`, `TicketMessage`, and `DisputeCase` writes.
Buyers open a general ticket or appeal a rejected return from the order help page.
Shop owners reply to tickets for their active shops. Administrators review cases,
record decisions, and add private notes.

## Access and context

- Buyer tickets are filtered by `userId`. An optional order must belong to the buyer.
- Shop context requires an owned order containing that shop. Shopless tickets are visible to the buyer and administrators.
- Seller support is limited to active, nondeleted shops owned by the signed-in user. Staff support access is not enabled in this increment.
- Seller responses contain ticket context and shop name. They contain no order relations, shipping address, user email, global payment facts, or another shop's items.
- Sender ID and sender type come from the authenticated route. Only administrator routes can write private notes.
- Buyer and seller message queries filter `isInternal=false` before pagination and counts. Private notes do not update the ticket's public workflow or ordering timestamp.
- Evidence is text only, limited to 5,000 characters. Subjects are limited to 200 characters. Attachments are deferred until private support storage and access controls are implemented.

## Appeals and transactions

An appeal accepts `returnRequestId`, `subject`, and `body`. The server verifies
buyer ownership and a `REJECTED` Return under the Order lock. It derives the order
and shop from that Return, then creates the ticket, initial message, and dispute
in one transaction. Nullable unique `DisputeCase.returnRequestId` preserves legacy
cases and enforces one appeal per Return. Retries return the existing ticket.

Support mutations lock Order first when present, then SupportTicket. They reread
ownership and current state under those locks. A failed message insert rolls back
the dispute update, ticket status, and decision together.

## Workflow

| Resource | Current state | Allowed next state |
|---|---|---|
| Ticket | OPEN or PENDING_CUSTOMER or PENDING_SELLER or PENDING_ADMIN | Another active state, RESOLVED, CLOSED |
| Ticket | RESOLVED | CLOSED |
| Ticket | CLOSED | None |
| Dispute | OPEN | UNDER_REVIEW, WAITING_EVIDENCE, RESOLVED_BUYER, RESOLVED_SELLER, CLOSED |
| Dispute | UNDER_REVIEW | WAITING_EVIDENCE, RESOLVED_BUYER, RESOLVED_SELLER, CLOSED |
| Dispute | WAITING_EVIDENCE | UNDER_REVIEW, RESOLVED_BUYER, RESOLVED_SELLER, CLOSED |
| Dispute | RESOLVED_BUYER, RESOLVED_SELLER, CLOSED, legacy COMPENSATED | None |

Active public replies move the ticket to the next participant's queue. An active
dispute routes buyer and seller replies to support. Administrators cannot resolve
or close a ticket while its dispute remains active. Every dispute transition
requires nonempty decision text. Final decisions persist `decision`, `resolvedAt`,
and a public SYSTEM message with the authenticated administrator ID and timestamp.
Review notes for nonfinal transitions remain in the conversation.

A decision changes support state only. It does not change Return, Order, Payment,
Refund, wallet, or inventory state. Financial execution follows the existing
[refund workflow](fulfillment-flow.md). No API accepts compensation amounts or
the COMPENSATED status.

## API and pages

| Audience | API base | Pages |
|---|---|---|
| Buyer | `/api/support` | `/[locale]/support`, `/support/new`, `/support/:ticketId`, `/orders/:orderId/support` |
| Seller | `/api/seller/support` | `/[locale]/seller/support`, `/seller/support/:ticketId` |
| Administrator | `/api/admin/support` | `/[locale]/admin/support`, `/admin/support/:ticketId` |

All audiences have GET `/tickets`, GET `/tickets/:ticketId`, and POST
`/tickets/:ticketId/messages` with `{body}`. Buyer creation is POST `/tickets`
with `{subject, body, orderId?, shopId?}`. Buyer POST `/appeals` creates an appeal.
GET `/orders/:orderId/returns` lists owned rejected Returns and existing appeal
ticket IDs.

Administrator POST `/tickets/:ticketId/notes` saves `{body}` privately. PATCH
`/tickets/:ticketId/status` takes `{status}`. PATCH `/tickets/:ticketId/dispute`
takes `{status, decision}`. Administrator routes use the ADMIN macro. Seller
routes use the operational seller macro and repository ownership scope.

Lists, rejected-return pickers, and conversations use `page` and `limit`. Defaults
are 1 and 20. The maximum limit is 50. Ticket lists support a status filter and
seller lists support an owned `shopId` filter.

The UI uses Eden-inferred types and TanStack Query. Thai and English forms label
text evidence explicitly, guard immediate repeated submissions, and retain input
after failed requests. Buyer profile, order details, seller navigation, and admin
navigation link to the relevant support pages.
