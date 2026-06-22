# Security Hardening

Backend API security is centralized in:

```txt
server/plugins/security.plugin.ts
server/modules/security/
```

## Controls

- Rate limiting is applied by route category:
  - public APIs
  - auth APIs
  - checkout/payment APIs
  - admin APIs
- Request bodies are rejected when `Content-Length` exceeds the configured limit.
- API responses use safe error formatting and must not expose stack traces in production.
- Security headers are set for API responses.
- Ownership guard helpers centralize buyer/seller access checks.
- Upload validation helpers allow only supported MIME types and bounded file sizes.
- Suspicious activity is logged through `appContext.logger`.

## Environment

```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=600
RATE_LIMIT_AUTH_MAX_REQUESTS=120
RATE_LIMIT_CHECKOUT_MAX_REQUESTS=180
RATE_LIMIT_ADMIN_MAX_REQUESTS=300
REQUEST_BODY_LIMIT_BYTES=1048576
```

These defaults are intended for small production/demo deployments behind a reverse proxy. Keep rate limiting enabled and tune the values per traffic profile instead of removing the control entirely.

## Rules

- Protected APIs must use `withAuth`.
- Admin APIs must use `withRole: 'ADMIN'`.
- Seller APIs must verify ownership with guard helpers or equivalent domain checks.
- Never trust client-provided `userId`, `role`, price, discount, or payment status.
- Never include passwords, tokens, secrets, cookies, authorization headers, or card data in error responses or logs.
