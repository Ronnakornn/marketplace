# Goal: Product UGC Content Moderation

## Outcome

Admins can moderate product user-generated content from a dedicated Content Moderation surface without mixing it into product listing moderation.

## Scope

- Create an admin Content Moderation workflow for product UGC.
- Cover product reviews, review reports, product questions, and product answers.
- Use admin route `/admin/content-moderation`.
- Keep moderation actions status-based and reversible where possible.
- Do not hard delete UGC in this milestone.
- Do not add automated abuse detection, ML scoring, or bulk moderation.

## Success Criteria

- Admins can find review/report/Q&A moderation work from a dedicated admin surface.
- Admin actions update only the intended content record or report record.
- Public product detail surfaces show only publishable content.
- Existing product moderation and seller product workflows remain separate.
