-- AlterTable
ALTER TABLE "Checkout" ADD COLUMN     "includedTaxTotal" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "reportedTaxTotal" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "includedTaxTotal" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "reportedTaxTotal" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ShopOrder" ADD COLUMN     "includedTaxTotal" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "reportedTaxTotal" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ShopSaleSnapshot" ADD COLUMN     "addedTaxTotal" BIGINT,
ADD COLUMN     "buyerShippingNet" BIGINT,
ADD COLUMN     "buyerShippingTax" BIGINT,
ADD COLUMN     "includedTaxTotal" BIGINT,
ADD COLUMN     "platformShippingNet" BIGINT,
ADD COLUMN     "platformShippingTax" BIGINT,
ADD COLUMN     "reportedTaxTotal" BIGINT,
ADD COLUMN     "sellerGrossMerchandise" BIGINT,
ADD COLUMN     "sellerGrossShipping" BIGINT,
ADD COLUMN     "taxCustodian" TEXT,
ADD COLUMN     "taxExclusiveFunding" TEXT,
ADD COLUMN     "taxFundingBasis" TEXT,
ADD COLUMN     "taxMode" TEXT,
ADD COLUMN     "taxPolicyRevision" TEXT,
ADD COLUMN     "taxRatePpm" INTEGER,
ADD COLUMN     "taxRounding" TEXT,
ADD COLUMN     "taxShippingBasis" TEXT,
ADD COLUMN     "taxableShipping" BOOLEAN;

-- AlterTable
ALTER TABLE "ItemSaleSnapshot" ADD COLUMN     "buyerMerchandiseNet" BIGINT,
ADD COLUMN     "buyerMerchandiseTax" BIGINT,
ADD COLUMN     "coinFundingNet" BIGINT,
ADD COLUMN     "coinFundingTax" BIGINT,
ADD COLUMN     "originalAffiliateEligibleNet" BIGINT,
ADD COLUMN     "originalCashbackEligibleNet" BIGINT,
ADD COLUMN     "platformCouponCode" TEXT,
ADD COLUMN     "platformCouponId" UUID,
ADD COLUMN     "platformCouponNet" BIGINT,
ADD COLUMN     "platformCouponTax" BIGINT,
ADD COLUMN     "shopCouponCode" TEXT,
ADD COLUMN     "shopCouponId" UUID;

-- AlterTable
ALTER TABLE "RefundItemAllocation" ADD COLUMN     "buyerTaxRefund" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "coinTaxReversal" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "platformCouponTaxReversal" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "successfulQuantityBefore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RefundShopAllocation" ADD COLUMN     "buyerShippingTaxRefund" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "platformShippingTaxReversal" BIGINT NOT NULL DEFAULT 0;
