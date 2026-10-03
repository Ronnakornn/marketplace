-- CreateEnum
CREATE TYPE "RefundShippingCause" AS ENUM ('NONE', 'PRE_SHIPMENT_CANCEL', 'SELLER_FAULT', 'CHANGE_OF_MIND');

-- CreateTable
CREATE TABLE "ShopSaleSnapshot" (
    "shopOrderId" UUID NOT NULL,
    "policyVersion" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL,
    "commissionBase" BIGINT NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "originalCommission" BIGINT NOT NULL,
    "originalShipping" BIGINT NOT NULL,
    "buyerShipping" BIGINT NOT NULL,
    "sellerShippingWaiver" BIGINT NOT NULL,
    "platformShippingSubsidy" BIGINT NOT NULL,
    "recognizedAt" TIMESTAMP(3),

    CONSTRAINT "ShopSaleSnapshot_pkey" PRIMARY KEY ("shopOrderId")
);

-- CreateTable
CREATE TABLE "ItemSaleSnapshot" (
    "orderItemId" UUID NOT NULL,
    "shopOrderId" UUID NOT NULL,
    "originalQuantity" INTEGER NOT NULL,
    "grossMerchandise" BIGINT NOT NULL,
    "sellerCouponDiscount" BIGINT NOT NULL,
    "platformCouponDiscount" BIGINT NOT NULL,
    "coinDiscount" BIGINT NOT NULL,
    "buyerMerchandise" BIGINT NOT NULL,
    "couponId" UUID,
    "couponCode" TEXT,

    CONSTRAINT "ItemSaleSnapshot_pkey" PRIMARY KEY ("orderItemId")
);

-- CreateTable
CREATE TABLE "RefundItemAllocation" (
    "id" UUID NOT NULL,
    "refundId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cashMerchandise" BIGINT NOT NULL,
    "platformCouponReversal" BIGINT NOT NULL,
    "coinFundingReversal" BIGINT NOT NULL,

    CONSTRAINT "RefundItemAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundShopAllocation" (
    "id" UUID NOT NULL,
    "refundId" UUID NOT NULL,
    "shopOrderId" UUID NOT NULL,
    "buyerShippingRefund" BIGINT NOT NULL DEFAULT 0,
    "platformShippingReversal" BIGINT NOT NULL DEFAULT 0,
    "commissionReversal" BIGINT NOT NULL DEFAULT 0,
    "shippingCause" "RefundShippingCause" NOT NULL DEFAULT 'NONE',
    "walletPostedAt" TIMESTAMP(3),

    CONSTRAINT "RefundShopAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemSaleSnapshot_shopOrderId_idx" ON "ItemSaleSnapshot"("shopOrderId");

-- CreateIndex
CREATE INDEX "RefundItemAllocation_orderItemId_idx" ON "RefundItemAllocation"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundItemAllocation_refundId_orderItemId_key" ON "RefundItemAllocation"("refundId", "orderItemId");

-- CreateIndex
CREATE INDEX "RefundShopAllocation_shopOrderId_idx" ON "RefundShopAllocation"("shopOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundShopAllocation_refundId_shopOrderId_key" ON "RefundShopAllocation"("refundId", "shopOrderId");

-- AddForeignKey
ALTER TABLE "ShopSaleSnapshot" ADD CONSTRAINT "ShopSaleSnapshot_shopOrderId_fkey" FOREIGN KEY ("shopOrderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSaleSnapshot" ADD CONSTRAINT "ItemSaleSnapshot_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSaleSnapshot" ADD CONSTRAINT "ItemSaleSnapshot_shopOrderId_fkey" FOREIGN KEY ("shopOrderId") REFERENCES "ShopSaleSnapshot"("shopOrderId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundItemAllocation" ADD CONSTRAINT "RefundItemAllocation_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundItemAllocation" ADD CONSTRAINT "RefundItemAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "ItemSaleSnapshot"("orderItemId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundShopAllocation" ADD CONSTRAINT "RefundShopAllocation_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundShopAllocation" ADD CONSTRAINT "RefundShopAllocation_shopOrderId_fkey" FOREIGN KEY ("shopOrderId") REFERENCES "ShopSaleSnapshot"("shopOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;
