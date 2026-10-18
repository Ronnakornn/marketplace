# Task 8: product boot data

Owner: catalog implementation agent in coordination with root. Files: catalog controller/composition contract as needed, app/features/product/product-data.server and associated tests. Do not duplicate backend response models.

Reduce detail then rating-summary HTTP dependency to one typed boot request that resolves slug once, returns canonical detail and optional best-effort rating summary. Keep existing detail/rating endpoints for other consumers, visibility checks, exact money, React.cache and SEO aggregate-rating requirements. Reuse existing Review service through dependency injection or an equally small existing boundary. A rating failure must not hide an otherwise visible product. Verify canonical UUID, hidden products, summary failure, metadata/page deduplication and HTTP request count.
