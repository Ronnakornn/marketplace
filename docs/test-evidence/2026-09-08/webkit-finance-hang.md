# WebKit finance teardown hang — 2026-09-08

## Test scope / observation

Read-only diagnosis of the140-test production-mode Playwright run after completed test88. No process control or new tests performed by this verifier. Full runner log: `%TEMP%/production-acceptance-browser-140.log`.

The next test was `e2e/finance-lifecycle.spec.ts`: “partial discounted return is approved and refunded once with the correct seller debit.” Its150-second timeout had not yielded a test result after several minutes.

## Trace evidence

Live traces: `test-results/.playwright-artifacts-6/traces/6b899183a171f9bb6ec1-19ea0029121fb2482345-recording*.trace`.

- Recording20: seller navigation to `/en/seller/finance` (`call@935`) completed. Final `getByText(/68\.00/).first()` visibility assertion (`call@937`) completed without error at monotonic512898.325ms. Trace last modified00:15:40 Bangkok.
- Recording21: native refund dialog accepted (`Dialog.accept`, `call@898`), completed499772.047ms; associated click and response wait completed.
- Recording22: second native refund dialog accepted (`call@924`), completed510540.049ms; response body and duplicate-refund API request completed.
- No unmatched before/after call remained in recordings18–22. No evidence of a pending native prompt.
- After that final assertion, source enters `finally`: `await Promise.all(contexts.map(c => c.close()))`, then `await db.$disconnect()`.

This supports a teardown hang after the business assertions, not a stalled refund interaction. Trace does not directly identify which close/disconnect Promise stalled.

## Process evidence

At inspection:

| PID | Parent | Process | Observation |
| --- | --- | --- | --- |
|9520|18868|node.exe|Playwright CLI `test --headed --max-failures=3`; responding|
|17572|9520|node.exe|Playwright workerProcessEntry; responding|
|17168|17572|Playwright.exe|WebKit2336 host; **Responding=False**, accumulated CPU100.58s|
|32652|17168|WebKitGPUProcess.exe|Owned browser child|
|14784|17168|WebKitNetworkProcess.exe|Owned browser child|
|41052|17168|WebKitWebProcess.exe|One remaining content process; responding|

[Process snapshot](webkit-finance-hang-processes.json) records which of these still existed when evidence was saved; parent may initiate cleanup concurrently.

## Classification / recommendation

**C — browser/test environment issue, provisional.** Host non-responsiveness plus completed assertions strongly implicates browser teardown. Concurrent context/video teardown is a hypothesis, not an established root cause. No business failure established by this observation.

Parent may stop only the owned WebKit host17168 to allow the runner to detect browser closure and recover. Preserve API/frontend processes. Reinspect ownership/existence before handling surviving child PIDs; do not broadly terminate all Node/WebKit processes.

Replacing concurrent finance context closure with sequential closure is a reasonable bounded harness experiment. Validate with an isolated WebKit finance rerun. Do not mark the interrupted test passed merely because its last assertion completed; runner completion and teardown remain required.

Evidence saved: 2026-09-08 00:18:46 +07:00.
At evidence-save time none of the six sampled PIDs remained; the snapshot is empty because parent cleanup occurred after the earlier live inspection.
