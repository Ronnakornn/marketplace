CREATE TYPE "SellerKycDocumentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "SellerKycDocument"
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "reviewStatus" "SellerKycDocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedById" UUID;

ALTER TABLE "ShopRating"
ADD COLUMN "moderatedAt" TIMESTAMP(3),
ADD COLUMN "moderatedById" UUID,
ADD COLUMN "moderationReason" TEXT;

CREATE INDEX "SellerKycDocument_applicationId_reviewStatus_idx"
ON "SellerKycDocument"("applicationId", "reviewStatus");

CREATE INDEX "SellerKycDocument_reviewedById_idx"
ON "SellerKycDocument"("reviewedById");

CREATE INDEX "ShopRating_shopId_status_updatedAt_idx"
ON "ShopRating"("shopId", "status", "updatedAt");

CREATE INDEX "ShopRating_status_moderatedAt_idx"
ON "ShopRating"("status", "moderatedAt");

CREATE INDEX "ShopRating_moderatedById_idx"
ON "ShopRating"("moderatedById");

ALTER TABLE "SellerKycDocument"
ADD CONSTRAINT "SellerKycDocument_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopRating"
ADD CONSTRAINT "ShopRating_moderatedById_fkey"
FOREIGN KEY ("moderatedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
