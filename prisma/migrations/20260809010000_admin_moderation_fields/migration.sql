DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SellerKycDocumentReviewStatus') THEN
    CREATE TYPE "SellerKycDocumentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- Fresh migration chains create ShopRating in the schema reconciliation
-- migration after all of its dependencies (including ShopOrder) exist.

ALTER TABLE "SellerKycDocument"
ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
ADD COLUMN IF NOT EXISTS "reviewStatus" "SellerKycDocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewedById" UUID;

ALTER TABLE IF EXISTS "ShopRating"
ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "moderatedById" UUID,
ADD COLUMN IF NOT EXISTS "moderationReason" TEXT;

CREATE INDEX IF NOT EXISTS "SellerKycDocument_applicationId_reviewStatus_idx"
ON "SellerKycDocument"("applicationId", "reviewStatus");

CREATE INDEX IF NOT EXISTS "SellerKycDocument_reviewedById_idx"
ON "SellerKycDocument"("reviewedById");

DO $$
BEGIN
  IF to_regclass('"ShopRating"') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "ShopRating_shopId_status_updatedAt_idx" ON "ShopRating"("shopId", "status", "updatedAt");
    CREATE INDEX IF NOT EXISTS "ShopRating_status_moderatedAt_idx" ON "ShopRating"("status", "moderatedAt");
    CREATE INDEX IF NOT EXISTS "ShopRating_moderatedById_idx" ON "ShopRating"("moderatedById");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SellerKycDocument_reviewedById_fkey') THEN
    ALTER TABLE "SellerKycDocument"
      ADD CONSTRAINT "SellerKycDocument_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF to_regclass('"ShopRating"') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShopRating_moderatedById_fkey') THEN
    ALTER TABLE "ShopRating"
      ADD CONSTRAINT "ShopRating_moderatedById_fkey"
      FOREIGN KEY ("moderatedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
