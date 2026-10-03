-- CreateTable
CREATE TABLE "AffiliateCommissionItem" (
    "id" UUID NOT NULL,
    "commissionId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "originalQuantity" INTEGER NOT NULL,
    "originalEligibleNet" BIGINT NOT NULL,

    CONSTRAINT "AffiliateCommissionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateRefundReversal" (
    "id" UUID NOT NULL,
    "commissionId" UUID NOT NULL,
    "refundId" UUID NOT NULL,
    "eligibleNetReversed" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateRefundReversal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AffiliateCommissionItem_orderItemId_idx" ON "AffiliateCommissionItem"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCommissionItem_commissionId_orderItemId_key" ON "AffiliateCommissionItem"("commissionId", "orderItemId");

-- CreateIndex
CREATE INDEX "AffiliateRefundReversal_refundId_idx" ON "AffiliateRefundReversal"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateRefundReversal_commissionId_refundId_key" ON "AffiliateRefundReversal"("commissionId", "refundId");

-- AddForeignKey
ALTER TABLE "AffiliateCommissionItem" ADD CONSTRAINT "AffiliateCommissionItem_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "AffiliateCommission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommissionItem" ADD CONSTRAINT "AffiliateCommissionItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateRefundReversal" ADD CONSTRAINT "AffiliateRefundReversal_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "AffiliateCommission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateRefundReversal" ADD CONSTRAINT "AffiliateRefundReversal_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
