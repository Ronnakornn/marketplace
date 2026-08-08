ALTER TABLE "Shop"
ADD COLUMN "descriptionTh" TEXT,
ADD COLUMN "descriptionEn" TEXT;

ALTER TABLE "ShopSetting"
ADD COLUMN "returnPolicyTh" TEXT,
ADD COLUMN "returnPolicyEn" TEXT,
ADD COLUMN "shippingPolicyTh" TEXT,
ADD COLUMN "shippingPolicyEn" TEXT;
