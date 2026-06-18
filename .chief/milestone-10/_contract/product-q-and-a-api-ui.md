# Contract: Product Q&A API And UI

## Module

Add a backend Q&A module, preferably `server/modules/product-question/`, unless local naming conventions strongly favor a different product domain module name.

## Public Read API

`GET /api/products/:productId/questions`

Returns published questions for active products from active shops:

```ts
{
  items: Array<{
    id: string
    productId: string
    shopId: string
    question: string
    status: "PUBLISHED"
    createdAt: Date
    user: { id: string; name: string }
    answers: Array<{
      id: string
      answer: string
      status: "PUBLISHED"
      createdAt: Date
      user: { id: string; name: string }
    }>
  }>
}
```

## Buyer Question API

`POST /api/products/:productId/questions`

Auth: `{ withAuth: true }`

Body:

```ts
{ question: string }
```

Rules:
- Product must be active and belong to an active shop.
- Question text is trimmed and non-empty.
- Created question status is `PUBLISHED` for this milestone.
- Admin moderation is out of scope.

## Seller Answer API

`POST /api/products/questions/:questionId/answers`

Auth: `{ withAuth: true }`

Body:

```ts
{ answer: string }
```

Rules:
- Question must exist and be `PUBLISHED`.
- Product must belong to the seller's active shop.
- Use existing active shop ownership helpers where possible.
- Answer text is trimmed and non-empty.
- Created answer status is `PUBLISHED`.

## Frontend UI

- Product detail lists published Q&A below or near reviews.
- Authenticated buyers can submit questions.
- Seller UI exposes unanswered questions and answer submission for product-owning sellers.
- UI handles loading, empty, error, and mutation states.

## Verification

- Service tests cover public list, buyer question creation, seller ownership enforcement, and answer creation.
- Route tests cover auth protection and stable error mapping.
- Frontend tests cover product detail Q&A rendering and buyer question submission.
