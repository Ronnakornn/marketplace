-- Better Auth 1.7 authenticates local credential accounts by provider, issuer, and account ID.
-- Existing accounts predate the issuer column, so expand, backfill, then enforce the invariant.
ALTER TABLE "Account" ADD COLUMN "issuer" TEXT;

UPDATE "Account"
SET "issuer" = CASE
  WHEN "providerId" = 'credential' THEN 'local:credential'
  WHEN "providerId" = 'google' THEN 'local:oauth:google'
  WHEN "providerId" = 'facebook' THEN 'local:oauth:facebook'
  ELSE 'local:oauth:' || "providerId"
END
WHERE "issuer" IS NULL;

ALTER TABLE "Account" ALTER COLUMN "issuer" SET NOT NULL;
