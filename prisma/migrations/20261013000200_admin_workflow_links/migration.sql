-- AlterTable
ALTER TABLE "ShopSaleSnapshot" ADD COLUMN     "deliverySlaHours" INTEGER NOT NULL DEFAULT 168,
ADD COLUMN     "dispatchSlaHours" INTEGER NOT NULL DEFAULT 72,
ADD COLUMN     "shippingProviderId" UUID,
ADD COLUMN     "shippingProviderName" TEXT,
ADD COLUMN     "shippingRateRuleId" UUID,
ADD COLUMN     "shippingRateVersion" INTEGER;

-- AlterTable
ALTER TABLE "DisputeCase" ADD COLUMN     "refundId" UUID;

-- AlterTable
ALTER TABLE "ContentPage" ADD COLUMN     "publishedTitle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DisputeCase_refundId_key" ON "DisputeCase"("refundId");

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
