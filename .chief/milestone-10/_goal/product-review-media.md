# Goal: Product Review Media

## Outcome

Buyer reviews can include trusted image attachments that are stored through the existing upload workflow and rendered on product surfaces.

## Scope

- Use the existing upload module for `review_image` uploads.
- Persist review images through `ReviewMedia`.
- Keep review video out of scope for this milestone.
- Keep review ownership tied to delivered order items.
- Preserve the existing duplicate-review protection for one review per order item.

## Success Criteria

- Buyers can submit review image upload references with a review.
- Review responses include persisted media records for public display.
- Invalid, incomplete, unsupported, or unauthorized upload references are rejected.
- Existing review create/update/delete behavior remains compatible.
