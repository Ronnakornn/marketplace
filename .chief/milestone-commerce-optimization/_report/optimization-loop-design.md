# Optimization loop design

Two independent sketches agreed on separate public-card projections, bounded impression batches, structural translation scopes and a dedicated product boot endpoint. Root chose explicit public read methods rather than conditional detail/card unions. Admin/seller retain their full DTOs. English fallback is resolved server-side, and nested role providers merge only their scoped additions into the public parent.

Impressions retain the existing single-event endpoint and add a dedicated bounded batch endpoint. A batch performs one active-product lookup and one bulk insert after all validation. Shared public rate admission charges each event rather than only each request. Client byte limits include UTF-8 wrapper bytes; oversized individual events are dropped, and delivery during unload remains best effort.

The boot controller composes existing Catalog and Review readers using the canonical product ID. Only Review failures are best effort. Existing detail/rating endpoints remain. This removes one HTTP dependency; it does not claim removal of all duplicate rating aggregation in PostgreSQL.

The next loop reduced related-product requests from eight to the four displayed cards. Reducing recently-viewed requests was rejected for now because its bounded latest-log window deduplicates after reading, so a smaller limit can reduce the distinct history available. A reviewer-detected mixed-case UUID batch regression was fixed and pinned by four tests.

Measurements use saved pre-change implementations and real PostgreSQL fixtures with matching card/quick-add/event facts. Serialized JSON bytes are uncompressed payload measurements. The image count measures returned objects; database image selection still reads ordered URLs so an unsafe primary image can fall back to a valid later URL. No latency/p95/LCP claim is made.

Further inspection found three additional bounded units. Cart hydration now selects only consumed product/variant/inventory scalars while retaining every cart/item scalar and image row. Flash Sale admission checks the unique candidate shop set once, preserving user overrides and maintenance precedence even for candidates that fall back to regular price. Coupon rules reuse the loaded candidate in each evaluation round; commitment still locks then reads fresh coupon, targets and redemption counts. Independent review and real PostgreSQL comparisons preserve responses, quote fingerprints, exact money and changed-coupon rollback.
