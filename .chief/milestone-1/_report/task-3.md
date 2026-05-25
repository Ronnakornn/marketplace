# Task 3 Report: Seller Dashboard API and Cache

## Summary

Improved cache client behavior for seller dashboard and other cached API paths.

## Change

- `createRedisCacheClient()` now returns a small wrapper around `ioredis`.
- The wrapper calls `connect()` before `get`, `set`, `del`, or `keys` when Redis is using `lazyConnect`.
- This prevents the first cache read from failing with `Stream isn't writeable and enableOfflineQueue options is false`.

## Why This Matters

Task 1 baseline showed the first seller dashboard API request logged:

- `Cache get failed`
- `CACHE_CONNECTION_FAILED`
- `Stream isn't writeable and enableOfflineQueue options is false`

That made the first dashboard request miss cache and added avoidable work/noise. The wrapper preserves lazy connection while ensuring commands are issued only after the Redis client is ready.

## Verification

- `bunx tsc --noEmit`
- `bun run test server/modules/cache/cache.client.test.ts server/modules/cache/cache.service.test.ts server/modules/seller/seller-dashboard.service.test.ts`

Both checks passed during task execution.
