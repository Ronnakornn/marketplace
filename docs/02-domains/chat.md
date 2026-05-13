# Chat Domain

The Chat domain owns buyer-seller communication and order context in conversations.

## Responsibilities

- Chat threads
- Messages
- Buyer/seller participants
- Order or product context
- Unread counts

## Business Rules

- Buyers can chat with sellers.
- Sellers can access threads for their shop only.
- Admin access to chat should be explicit and audited if implemented.
- Chat context can reference product or order information but must not expose unauthorized order data.

## API Surface

MVP chat APIs can be added after core commerce flows:
- `GET /api/chat`
- `GET /api/chat/:threadId`
- `POST /api/chat/:threadId/messages`

## Frontend Surfaces

- Buyer chat inbox
- Buyer/seller chat thread
- Seller chat inbox
- Product detail Chat Seller action
- Order detail Chat Seller action

## Edge Cases

- Shop suspended.
- Product deleted.
- Order context hidden from unauthorized participant.
- Unread count stale.

## Acceptance Criteria

- Chat thread authorization is participant-based.
- Seller can only access owned shop threads.
