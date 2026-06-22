# Contract: Media Manager UI

## Product Images

Required behavior:

- file picker or drag/drop upload
- pending/progress/completed/error states
- image grid
- reorder controls
- primary image selection
- alt text edit
- remove image
- readiness warning when primary image is missing

Rules:

- Existing media remains visible during upload failures.
- Product image limit is surfaced before upload when possible.
- Exactly one primary image can be selected.

## Product Video

Required behavior:

- one video slot
- upload/attach action
- preview when available
- replace action
- remove action
- unsupported/failed state

Rules:

- Video content type and size errors come from upload/catalog API responses.
- Do not implement cropper, background remover, or per-variant media mapping.
