# CDN and Asset Optimization

Task 33 defines the baseline CDN policy for public marketplace assets.

## Environment

```env
NEXT_PUBLIC_SITE_URL="https://marketplace.example.com"
NEXT_PUBLIC_CDN_URL="https://cdn.example.com"
NEXT_PUBLIC_ASSET_BASE_URL="https://assets.example.com"
S3_PUBLIC_BASE_URL="https://bucket.storage.example.com"
```

- `NEXT_PUBLIC_CDN_URL` is the preferred public URL for uploaded product and shop images.
- `NEXT_PUBLIC_ASSET_BASE_URL` is used by Next.js as `assetPrefix` for static build assets. If omitted, `NEXT_PUBLIC_CDN_URL` is used.
- `S3_PUBLIC_BASE_URL` is only a public origin fallback. Do not expose signed S3 URLs or secret storage endpoints to the browser.
- `NEXT_PUBLIC_SITE_URL` is the canonical app URL for SEO metadata.

## Cache Policy

Recommended response headers:

- Static build/public assets: `public, max-age=31536000, immutable`
- Public uploaded product/shop images: `public, max-age=604800, stale-while-revalidate=86400`
- Private pages and private API responses: `no-store`

Do not globally cache:

- `/api/*`
- `/admin/*`
- `/seller/*`
- `/cart`
- `/checkout`
- `/payment/*`

Product images can be cached. Private user files must not be placed under public upload paths or cached by the CDN.

## Image Rules

- Use `next/image` for product images.
- Remote image hosts must be explicitly configured through `NEXT_PUBLIC_CDN_URL`, `NEXT_PUBLIC_ASSET_BASE_URL`, or `S3_PUBLIC_BASE_URL`.
- Provide width/height or responsive `fill` with stable aspect-ratio containers to avoid layout shift.
- Use `/images/fallback-product.svg` and `/images/fallback-shop.svg` when public images are missing.
- Route uploaded product images through `NEXT_PUBLIC_CDN_URL` when configured.

## Cloudflare Setup

1. Add the app domain and CDN/static asset hostname to Cloudflare.
2. Point the CDN hostname at the static asset origin or public S3-compatible bucket origin.
3. Create cache rules:
   - Cache `/_next/static/*` and public file extensions for one year.
   - Cache `/uploads/product_image/*` and `/uploads/shop_image/*` for seven days with stale revalidation.
   - Bypass cache for `/api/*`, `/admin/*`, `/seller/*`, `/cart`, `/checkout`, and `/payment/*`.
4. Enable Brotli compression.
5. Enable Cloudflare image optimization if available.
6. Configure WAF and rate limiting separately from application rate limiting.
7. Verify signed S3 URLs are never embedded in product payloads or rendered HTML.

Do not automate Cloudflare API changes as part of this task.
