# Chat message actions

Participants can copy text, copy a selected image, and reply to a message or selected image. Image copy decodes the private image and writes PNG bytes to the clipboard, including JPEG and WebP sources. Unsupported browsers and denied permissions receive localized feedback. Download remains available.

The original sender can delete an entire message or only one selected image after confirmation. Selected-image deletion preserves the caption and other files. Removing the last image from a captionless message leaves a tombstone. Deletion remains available when the shop disables sending. The current participant, sender, room, and selected shop are checked again under the thread row lock. Staff, administrators, and strangers cannot perform these actions.

JSON and multipart sends accept `replyToMessageId` and optional `replyToAttachmentId`. The image must be live and belong to the live source message in the same room. Replies reference the source without copying its body or thumbnail. A deleted source produces an unavailable quote with the source content version. Exact UUID replay is checked before source liveness. A retry after deletion returns the current redacted state. Changed body, file ordering, context, or reply IDs conflict with the original UUID.

`DELETE /api/chats/:roomId/messages/:messageId` removes the entire message. `DELETE /api/chats/:roomId/messages/:messageId/attachments/:attachmentId` removes the selected image. Both accept optional `scope` and `shopId` query parameters. Successful responses include room metadata and `changedMessage`. Repeated authorized deletion has no additional revision, activity, notification, or realtime effect.

Each genuine deletion increments `ChatThread.contentRevision` and the message's `contentVersion`. Revisions cross HTTP as decimal strings. `POST /api/chats/:roomId/messages/refresh` accepts 1 to 50 distinct message UUIDs plus optional scope/shop ID. It reads the authorized room revision, messages, and direct quote sources in one repeatable-read snapshot. IDs outside the room produce no content.

History retains tombstones as stable pagination and read anchors. Unread counts and inbox previews exclude deleted messages. The DTO removes deleted bodies, files, filenames, URLs, legacy arrays, product/order context, and the deleted message's own quote. Private content GET returns 404 when either the attachment or its parent is deleted.

The client preserves monotonic message, quote, room-revision, and read-boundary state across every response. Revision changes trigger bounded refreshes of all loaded IDs. Concurrent changes retry for up to three scans and then wait for the next recovery attempt. Newly loaded older pages receive an authoritative refresh before display, even after the room revision was already reconciled. New-message recovery retains its separate contiguous creation cursor. Fresh
messages at an already reconciled revision retain that proof. Older pages still
receive their own authoritative refresh. Send responses refresh only the sent ID
before trusting its message and live reply projection. Each full reconciliation
merges its bounded refresh batches once. The message history has a memo boundary
so composer keystrokes do not rebuild message rows. Polling, focus, and reconnect repair missed reference-only `chat.message.changed` events.

New chat notifications use generic text. Notification API projections also hide legacy chat previews. The frontend renders localized generic chat notification text. Other notification types keep their existing content.

Deletion is logical removal from application responses. Original body, ordered metadata, hashes, private object keys, and reply IDs remain private for immutable replay and conservative retention. Stored bytes remain referenced. This feature adds no purge schedule and cannot erase bytes already delivered, downloaded, or in flight.

The PostgreSQL chat suite exercises selected-image deletion, replay, ownership, disabled sending, retained cursors, and redacted quotes. Frontend regressions cover monotonic merges and a stale older page arriving after reconciliation. Apply migrations and generate Prisma before the suite. Use only an isolated local `*_test` database in `CHAT_TEST_DATABASE_URL`.
