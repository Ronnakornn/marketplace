CREATE TYPE "CouponRedemptionStatus" AS ENUM ('RESERVED', 'REDEEMED', 'RELEASED');
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYOUT_STATUS_CHANGED';

ALTER TABLE "CouponRedemption" ADD COLUMN "status" "CouponRedemptionStatus";
UPDATE "CouponRedemption" SET "status" = 'REDEEMED';
ALTER TABLE "CouponRedemption" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "CouponRedemption" ALTER COLUMN "status" SET DEFAULT 'RESERVED';

DROP INDEX IF EXISTS "CouponRedemption_couponId_idx";
DROP INDEX IF EXISTS "CouponRedemption_userId_idx";
CREATE INDEX "CouponRedemption_couponId_status_idx" ON "CouponRedemption"("couponId", "status");
CREATE INDEX "CouponRedemption_userId_couponId_status_idx" ON "CouponRedemption"("userId", "couponId", "status");
