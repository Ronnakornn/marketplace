# Task 5: impression batches

Owner: tracking implementation agent. Files: app/features/tracking and server/modules/tracking, plus directly affected tests and bounded security admission configuration if required.

Batch only product impressions initially; preserve the single-event endpoint for other event types. Bound item count and encoded transport bytes for beacon/keepalive. Validate all IDs, shop ownership and metadata before writing; bulk-read active products and bulk-insert log rows without merging distinct event/source/session facts. Preserve visible-card deduplication and unmount flushing. Derive TypeBox body composition from existing event validator. Test malformed/mixed ownership payloads, limits, duplicate facts, timestamps, beacon failure fallback and chunking. No schema changes.
