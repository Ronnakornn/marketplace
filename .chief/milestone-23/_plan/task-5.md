# Task 5: Verification and Browser Evidence

## Objective

Verify milestone-23 end to end and capture evidence that buyer-facing English and Thai text render correctly.

## Affected Areas

- `.chief/milestone-23/_report/`
- browser evidence screenshots
- verification report

## Requirements

- Run the deterministic i18n audit.
- Run `bunx tsc --noEmit`.
- Run focused tests impacted by buyer/public shopping i18n migration.
- Start local dev servers if browser verification requires them.
- Capture browser evidence for:
  - `/en` home or public shopping entry page
  - `/th` home or public shopping entry page
  - one English authenticated buyer core page when local session/demo data allows
  - one Thai authenticated buyer core page when local session/demo data allows
- Check browser console for obvious runtime errors.
- Write verification notes to `.chief/milestone-23/_report/verification.md`.
- Write autopilot batch report to `.chief/milestone-23/_report/autopilot-run-batch-1.md`.

## Constraints

- If local demo data lacks populated records, capture available empty/authenticated states and document the limitation.
- Do not mutate unrelated demo data solely for screenshots.
- Stop any dev server started for verification before finishing.

## Done When

- Verification report exists.
- Browser evidence is saved under `.chief/milestone-23/_report/`.
- `_todo.md` marks task-5 complete.
