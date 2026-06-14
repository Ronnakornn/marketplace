# Task 4: Product Q&A Frontend

## Goal

Integrate product Q&A into buyer product detail and seller answering surfaces.

## Inputs

- Goals:
  - `_goal/product-q-and-a.md`
- Contracts:
  - `_contract/product-q-and-a-api-ui.md`

## Required Work

- Add frontend API/query helpers for:
  - public product question list
  - buyer question submission
  - seller answer submission
- Product detail page:
  - list published questions and answers
  - show empty/loading/error states
  - show authenticated buyer question form where appropriate
- Seller surface:
  - expose unanswered product questions for product-owning sellers
  - allow answer submission with clear mutation states
  - keep seller ownership enforcement server-side
- Reuse existing app shells and product/seller feature structure.

## Verification

- Add/update frontend tests covering:
  - populated Q&A rendering
  - empty Q&A state
  - buyer question submission state
  - seller answer submission state
- Run:

```bash
bun run test app/features/product/components/ProductBuyerStates.test.tsx
bun run test app/features/seller/components/SellerProductPages.test.tsx
bunx tsc --noEmit
```

## Out Of Scope

- Admin moderation.
- Voting, reporting, threaded replies, or notifications.
- Full seller support inbox redesign.
