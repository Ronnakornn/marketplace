# Backend Issue 004: KYC Upload Security

## Impact

KYC documents and identifiers are high-risk data. The schema supports KYC uploads and encrypted fields, but services must enforce ownership, masking, content type, and no plaintext leakage.

## Tasks

- Add encryption/key management for Thai ID, tax ID, company registration, and bank account number.
- Validate `KYC_ENCRYPTION_KEY` in production.
- Allow `KYC_DOCUMENT` uploads for authenticated users.
- Restrict KYC documents to completed uploads owned by the application user.
- Support PDF/JPEG/PNG content types and size limits.
- Return only masked identifiers and upload metadata to admin/frontend.
- Add audit logging for admin KYC review actions.

## Acceptance Criteria

- No API response returns decrypted KYC identifiers.
- Non-owner cannot complete/read/use another user's KYC upload.
- Admin can review document metadata and masked fields only.
