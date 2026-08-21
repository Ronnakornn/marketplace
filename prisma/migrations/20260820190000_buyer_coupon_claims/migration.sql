CREATE TABLE "CouponClaim" (
    "id" UUID NOT NULL,
    "couponId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponClaim_couponId_userId_key" ON "CouponClaim"("couponId", "userId");
CREATE INDEX "CouponClaim_userId_claimedAt_idx" ON "CouponClaim"("userId", "claimedAt");
CREATE INDEX "CouponClaim_couponId_claimedAt_idx" ON "CouponClaim"("couponId", "claimedAt");

ALTER TABLE "CouponClaim"
ADD CONSTRAINT "CouponClaim_couponId_fkey"
FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouponClaim"
ADD CONSTRAINT "CouponClaim_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
