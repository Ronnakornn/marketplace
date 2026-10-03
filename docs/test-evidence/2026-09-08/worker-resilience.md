# Worker resilience — 2026-09-08

## Test Scope

Bounded local integration verification of JOB-03, portions of JOB-04/JOB-05/PERF-05/OPS-04. Application code unchanged. Used actual `BullMqQueueProducer`, `createJobWorker`, `createJobQueueEvents`, `JobService`, `PrismaJobRepository`, Redis, and PostgreSQL. Email transport was an explicitly injected local failure fixture; no external delivery attempted.

Environment: Windows/Bun; PostgreSQL17 at127.0.0.1:55439, disposable `marketplace_test_queue`; application context `test`. A separate Redis5.0.14.1 server at127.0.0.1:56380/14 used a unique temporary data directory, AOF enabled, `appendfsync always`. Version checking remained enabled (`skipRedisVersionCheck:false`). Application worker factories hardcode `marketplace-jobs`; isolated server ownership supplied isolation instead of modifying its prefix. Existing Redis56379 and its databases were untouched.

## Commands Executed

- `bun run <unique-temp-directory>/drill.ts`: starts owned Redis with `--bind 127.0.0.1 --port 56380 --dir <unique-temp-directory> --appendonly yes --appendfsync always --save ""` using a hidden child process.
- Starts two real worker factories, concurrency1 each, and actual queue producer with its default3 attempts/exponential5000ms backoff.
- Enqueues transient/permanent failing email fixtures; inspects actual job states and structured logger calls.
- Pauses both workers, enqueues20 unique notification jobs, executes `SHUTDOWN SAVE` on owned Redis, submits one enqueue during unavailability, restarts same Redis data directory, resumes workers.
- Queries actual PostgreSQL notifications belonging only to the newly created unique test user.
- Holds an active transport fixture, calls `worker.close()`, checks close waits, releases fixture, verifies completed state.
- Closes workers and queues, obliterates only the owned queue, stops only owned Redis56380. No `FLUSHDB`, shared fixture edits, or application edits.

## Results

**PASS for the bounded scenarios below.** Assertions completed in18.020 seconds. Result JSON contains explicit `pass:true`; tool exit code alone was not treated as evidence.

| Case | Observed evidence |
| --- | --- |
| Transient retry | First2 attempts failed; third succeeded. Measured retry intervals5035ms,10024ms. |
| Retry exhaustion | Three failures; measured intervals5033ms,10025ms. Job retained in `failed`; worker emitted `JOB_RETRY_EXHAUSTED` with `exhausted:true`. |
| Redis reconnect/persistence |20 acknowledged queued jobs survived Redis shutdown/restart; another enqueue remained pending while disconnected, then resolved. Unavailability-to-reconnection/enqueue completion1381ms. Redis log confirms loading the append-only file. |
| Two-worker processing |21 expected notification rows,21 distinct titles, no missing/duplicate rows. Worker1 completed14; worker2 completed7. |
| In-flight factory close | `worker.close()` remained pending while active transport was held for200ms; resolved after release; job completed. |
| Final queue |23 completed,1 intentionally exhausted failure,0 active/waiting/delayed. |

One unique fixture user (`8dc97119-771c-42a2-87c8-9b6a99294340`) and21 notifications remain in the disposable PostgreSQL database. Redis56380 stopped after cleanup; no listener remained.

## Failure Analysis

No implementation failure observed in these bounded cases. The one failed queue job was deliberate fault injection and its retained failure/structured error was the expected assertion.

**C — environment limitations:** Redis5.0.14.1 passes BullMQ's enabled version check but logs a recommendation for6.2 or newer. This is not deployed Redis-version certification. No deployed alert receiver was exercised; logger capture demonstrates local error emission only.

## Recommendation

- JOB-03: local actual retry/backoff/exhaustion behavior verified; deployment alert delivery still required.
- JOB-04 / PERF-05: local client reconnect plus persistence across an orderly `SHUTDOWN SAVE` verified. Abrupt crash/power loss, network partition, failover, production persistence settings, DB outage and provider outage remain unverified.
- JOB-05: competing live workers processed distinct notification jobs without duplicates. This does not establish exactly-once financial effects during worker crashes, duplicate enqueue, lock loss or stalled-job replay.
- OPS-04: active factory close drains a controlled job. Deployed CLI/process-manager SIGTERM behavior still requires its own test; do not equate this with an OS-level graceful-shutdown result.
- JOB-02: mid-financial-job process kill/restart remains pending.
- Production readiness and milestone completion are not declared.

Evidence: [result JSON](worker-resilience-result.json), [structured events](worker-resilience-events.jsonl), [Redis persistence/restart log](worker-resilience-redis.log).
