# Task 4: Polish Product Media, Facts, Tests, And Verification Report

## Goal

Finish the buyer product detail UX pass by improving scanability of existing media/facts and recording verification evidence.

## Applies To

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/components/ProductBuyerStates.test.tsx`
- `.chief/milestone-9/_report/`

## Requirements

- Improve media gallery presentation using existing image and video data.
- Improve product facts/specification scanability without requiring new backend fields.
- Keep reviews, Q&A, seller trust expansion, and recommendations out of this milestone.
- Add or update focused tests for:
  - variant option state
  - disabled reasons
  - quantity clamp/reset
  - sticky summary
  - existing add-to-cart and buy-now behavior
- Run required commands from `.chief/milestone-9/_contract/verification.md`.
- Write a final verification report under `.chief/milestone-9/_report/`.

## Acceptance Criteria

- Product media and facts are easier to scan than the current raw presentation.
- Existing product detail buyer flows remain functional.
- Required tests and typecheck pass, or any blocker is documented with exact command output context.
- Final report records implemented tasks, commands run, browser verification, and residual risks.

## Guardrails

- Do not modify generated files manually.
- Do not add database migrations.
- Do not expand scope into faceted filters, seller/admin UI, reviews, Q&A, or checkout.
