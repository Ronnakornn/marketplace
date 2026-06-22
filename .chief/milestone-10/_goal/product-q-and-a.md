# Goal: Product Q&A

## Outcome

Buyers can ask product questions and sellers can answer them, giving product detail pages a lightweight buyer/seller clarification channel.

## Scope

- Add buyer question creation for authenticated buyers.
- Add seller answer creation for sellers who own the product shop.
- Publish buyer questions and seller answers immediately in this milestone.
- List published questions and answers on product detail pages.
- Use existing `ProductQuestion` and `ProductAnswer` schema models.
- Do not implement admin moderation, reporting, voting, or threaded replies.

## Success Criteria

- Public product detail can list published questions and answers.
- Authenticated buyers can submit a product question.
- Product-owning sellers can answer questions.
- Seller ownership is validated server-side.
- Q&A UI handles loading, empty, error, and mutation states.
