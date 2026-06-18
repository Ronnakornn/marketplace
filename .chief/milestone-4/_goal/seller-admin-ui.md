# Goal: Seller and Admin Product UI

## Outcome

Seller Center and Admin screens expose the product workflows needed to operate the catalog without direct API calls.

## Scope

- Add seller product list, create draft, and edit product pages.
- Add variant matrix editor and inventory panel per variant.
- Add submit-for-review and moderation status display.
- Add admin moderation queue with approve, reject, suspend, and restore actions.
- Do not add bulk product operations in this milestone.
- Do not revamp buyer product detail UI beyond required data compatibility.

## Success Criteria

- Seller UI handles loading, empty, error, and forbidden states.
- Admin moderation UI uses existing admin layout and route protections.
- Frontend data uses Eden Treaty and React Query inferred types.
- No frontend business rules are placed in shared UI components.
