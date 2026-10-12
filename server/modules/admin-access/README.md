# Administrator access

Every permission check reads current membership and current user state. A member must have an active verified ADMIN user. Owners receive the closed permission registry. Missing memberships deny access. The deployment migration bootstraps eligible existing administrators; a separate explicit seed operation bootstraps a new owner.

Team writes use PostgreSQL transaction advisory lock `719362804`, recheck the actor, compare the saved version and audit in the same transaction. User role/status/deletion writes must use this lock and preserve an eligible active owner. A nonowner cannot grant a permission they do not have, edit owner membership, or promote an owner. Self escalation is rejected.

`createAdminAccessGuard` is a global Elysia plugin mounted before all domain routes. It maps exact HTTP methods and paths. Unknown administrator paths and methods fail closed. Extra module routes use the same typed `AdminRoutePermission` registry passed as `options.routes`. `/api/users` legacy administrator aliases receive the same checks. The existing authentication macros remain required.

Account rules compare the authenticated account. IP rules normalize IPv4/IPv6 CIDRs and use the server connection. `ADMIN_TRUSTED_PROXY_CIDRS` permits forwarded addresses only through known proxy hops. Device rules compare a SHA256 hash of a server signed HttpOnly browser cookie. A cleared cookie or new browser gets a new identity; this is a browser control, not a hardware identifier. `/api/admin/me/access` exposes the current device hash to the administrator for rule entry.

The highest matching priority applies. DENY wins equal priority. ALLOW never grants authentication or permissions. Auth, health and verified webhook entrypoints remain available to their existing authorization or signature validators.
