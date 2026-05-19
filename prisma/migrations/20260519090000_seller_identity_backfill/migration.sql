-- Seller identity migration/backfill.
-- Moves seller identity away from User.role = SELLER and into SellerProfile + active owned Shop.
--
-- This migration is intended for staging/production databases created from the
-- earlier marketplace schema where Role contained USER/SELLER/ADMIN.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums added after the initial marketplace schema.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SellerBusinessType') THEN
    CREATE TYPE "SellerBusinessType" AS ENUM ('INDIVIDUAL', 'COMPANY');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SellerVerificationStatus') THEN
    CREATE TYPE "SellerVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SellerApplicationStatus') THEN
    CREATE TYPE "SellerApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SellerKycDocumentType') THEN
    CREATE TYPE "SellerKycDocumentType" AS ENUM ('ID_CARD', 'BUSINESS_CERTIFICATE', 'BANK_BOOK', 'TAX_DOCUMENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SellerKycDocumentSide') THEN
    CREATE TYPE "SellerKycDocumentSide" AS ENUM ('FRONT', 'BACK', 'EXTRA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShopAddressType') THEN
    CREATE TYPE "ShopAddressType" AS ENUM ('PICKUP', 'RETURN', 'WAREHOUSE', 'BILLING');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShopActivityAction') THEN
    CREATE TYPE "ShopActivityAction" AS ENUM (
      'SHOP_CREATED',
      'SHOP_UPDATED',
      'SHOP_STATUS_CHANGED',
      'SELLER_APPLICATION_SUBMITTED',
      'SELLER_APPLICATION_APPROVED',
      'SELLER_APPLICATION_REJECTED',
      'STAFF_INVITED',
      'STAFF_UPDATED',
      'STAFF_REMOVED',
      'SETTINGS_UPDATED',
      'ADDRESS_CREATED',
      'ADDRESS_UPDATED',
      'ADDRESS_DELETED',
      'PAYOUT_REQUESTED',
      'PAYOUT_APPROVED',
      'PAYOUT_REJECTED',
      'PAYOUT_PAID'
    );
  END IF;
END $$;

ALTER TYPE "ShopStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "ShopStatus" ADD VALUE IF NOT EXISTS 'BANNED';
ALTER TYPE "ShopStatus" ADD VALUE IF NOT EXISTS 'VACATION';
ALTER TYPE "UploadUsage" ADD VALUE IF NOT EXISTS 'REVIEW_VIDEO';
ALTER TYPE "UploadUsage" ADD VALUE IF NOT EXISTS 'KYC_DOCUMENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SELLER_APPLICATION_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SELLER_PROFILE_STATUS_CHANGED';

-- Keep a temporary snapshot before converting Role.
CREATE TEMP TABLE "_seller_identity_former_sellers" ON COMMIT DROP AS
SELECT "id" AS "userId"
FROM "User"
WHERE "role"::text = 'SELLER'
UNION
SELECT DISTINCT "ownerId" AS "userId"
FROM "Shop";

CREATE TABLE IF NOT EXISTS "SellerProfile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL UNIQUE,
  "businessType" "SellerBusinessType" NOT NULL DEFAULT 'INDIVIDUAL',
  "verificationStatus" "SellerVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "legalName" text,
  "displayName" text,
  "contactEmail" text,
  "contactPhone" text,
  "nationalIdHash" text,
  "nationalIdEncrypted" text,
  "nationalIdLast4" text,
  "maxShopCount" integer NOT NULL DEFAULT 5,
  "companyName" text,
  "companyRegistrationEncrypted" text,
  "companyRegistrationLast4" text,
  "taxIdEncrypted" text,
  "taxIdLast4" text,
  "bankName" text,
  "bankAccountName" text,
  "bankAccountNumberEncrypted" text,
  "bankAccountNumberLast4" text,
  "verifiedAt" timestamp(3),
  "rejectedReason" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "SellerProfile_verificationStatus_idx" ON "SellerProfile" ("verificationStatus");
CREATE INDEX IF NOT EXISTS "SellerProfile_businessType_idx" ON "SellerProfile" ("businessType");
CREATE INDEX IF NOT EXISTS "SellerProfile_nationalIdHash_idx" ON "SellerProfile" ("nationalIdHash");

INSERT INTO "SellerProfile" (
  "userId",
  "verificationStatus",
  "legalName",
  "displayName",
  "contactEmail",
  "verifiedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  u."id",
  CASE WHEN EXISTS (SELECT 1 FROM "Shop" s WHERE s."ownerId" = u."id" AND s."status" = 'ACTIVE') THEN 'VERIFIED'::"SellerVerificationStatus" ELSE 'UNVERIFIED'::"SellerVerificationStatus" END,
  u."name",
  u."name",
  u."email",
  CASE WHEN EXISTS (SELECT 1 FROM "Shop" s WHERE s."ownerId" = u."id" AND s."status" = 'ACTIVE') THEN CURRENT_TIMESTAMP ELSE NULL END,
  COALESCE(u."createdAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "User" u
JOIN "_seller_identity_former_sellers" fs ON fs."userId" = u."id"
ON CONFLICT ("userId") DO UPDATE SET
  "contactEmail" = COALESCE("SellerProfile"."contactEmail", EXCLUDED."contactEmail"),
  "displayName" = COALESCE("SellerProfile"."displayName", EXCLUDED."displayName"),
  "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "sellerProfileId" uuid;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "sellerIdentityHash" text;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "contactEmail" text;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "contactPhone" text;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "logoUrl" text;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "coverUrl" text;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "suspendedReason" text;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "rejectedReason" text;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "approvedById" uuid;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "approvedAt" timestamp(3);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "ratingAverage" decimal(3, 2) NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "ratingCount" integer NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "followerCount" integer NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "productCount" integer NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "metaTitle" text;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "metaDescription" text;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp(3);

UPDATE "Shop" s
SET
  "sellerProfileId" = sp."id",
  "sellerIdentityHash" = COALESCE(s."sellerIdentityHash", md5(s."ownerId"::text)),
  "contactEmail" = COALESCE(NULLIF(s."contactEmail", ''), u."email"),
  "contactPhone" = COALESCE(s."contactPhone", ''),
  "approvedAt" = CASE WHEN s."status" = 'ACTIVE' AND s."approvedAt" IS NULL THEN s."updatedAt" ELSE s."approvedAt" END
FROM "SellerProfile" sp
JOIN "User" u ON u."id" = sp."userId"
WHERE s."ownerId" = sp."userId";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Shop" WHERE "sellerProfileId" IS NULL OR "contactEmail" IS NULL OR "contactPhone" IS NULL) THEN
    RAISE EXCEPTION 'Cannot make Shop sellerProfileId/contact fields required; unresolved shop rows remain';
  END IF;
END $$;

ALTER TABLE "Shop" ALTER COLUMN "sellerProfileId" SET NOT NULL;
ALTER TABLE "Shop" ALTER COLUMN "contactEmail" SET NOT NULL;
ALTER TABLE "Shop" ALTER COLUMN "contactPhone" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Shop_sellerProfileId_fkey') THEN
    ALTER TABLE "Shop"
      ADD CONSTRAINT "Shop_sellerProfileId_fkey"
      FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Shop_approvedById_fkey') THEN
    ALTER TABLE "Shop"
      ADD CONSTRAINT "Shop_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Shop_sellerProfileId_idx" ON "Shop" ("sellerProfileId");
CREATE INDEX IF NOT EXISTS "Shop_sellerIdentityHash_status_idx" ON "Shop" ("sellerIdentityHash", "status");
CREATE INDEX IF NOT EXISTS "Shop_approvedById_idx" ON "Shop" ("approvedById");
CREATE INDEX IF NOT EXISTS "Shop_contactEmail_idx" ON "Shop" ("contactEmail");
CREATE INDEX IF NOT EXISTS "Shop_contactPhone_idx" ON "Shop" ("contactPhone");
CREATE INDEX IF NOT EXISTS "Shop_deletedAt_idx" ON "Shop" ("deletedAt");

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sellerProfileId" uuid;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sellerIdentityHash" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp(3);

UPDATE "Product" p
SET
  "sellerProfileId" = s."sellerProfileId",
  "sellerIdentityHash" = s."sellerIdentityHash"
FROM "Shop" s
WHERE p."shopId" = s."id"
  AND (p."sellerProfileId" IS NULL OR p."sellerIdentityHash" IS NULL);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_sellerProfileId_fkey') THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_sellerProfileId_fkey"
      FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Product_sellerProfileId_status_deletedAt_createdAt_idx" ON "Product" ("sellerProfileId", "status", "deletedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_sellerProfileId_status_idx" ON "Product" ("sellerProfileId", "status");

CREATE TABLE IF NOT EXISTS "SellerApplication" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "shopId" uuid UNIQUE,
  "sellerProfileId" uuid,
  "status" "SellerApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "businessType" "SellerBusinessType" NOT NULL DEFAULT 'INDIVIDUAL',
  "shopName" text NOT NULL,
  "shopSlug" text NOT NULL,
  "shopContactEmail" text NOT NULL,
  "shopContactPhone" text NOT NULL,
  "legalName" text NOT NULL,
  "contactEmail" text NOT NULL,
  "contactPhone" text NOT NULL,
  "nationalIdHash" text,
  "nationalIdEncrypted" text,
  "nationalIdLast4" text,
  "companyRegistrationEncrypted" text,
  "companyRegistrationLast4" text,
  "taxIdEncrypted" text,
  "taxIdLast4" text,
  "bankName" text NOT NULL DEFAULT '',
  "bankAccountName" text NOT NULL DEFAULT '',
  "bankAccountNumberEncrypted" text NOT NULL DEFAULT '',
  "bankAccountNumberLast4" text NOT NULL DEFAULT '',
  "pickupName" text NOT NULL DEFAULT '',
  "pickupPhone" text,
  "pickupLine1" text NOT NULL DEFAULT '',
  "pickupLine2" text,
  "pickupCity" text NOT NULL DEFAULT '',
  "pickupRegion" text,
  "pickupPostalCode" text NOT NULL DEFAULT '',
  "pickupCountry" text NOT NULL DEFAULT 'TH',
  "submittedAt" timestamp(3),
  "reviewedAt" timestamp(3),
  "reviewedById" uuid,
  "rejectionReason" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "SellerApplication_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL,
  CONSTRAINT "SellerApplication_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE SET NULL,
  CONSTRAINT "SellerApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL
);

INSERT INTO "SellerApplication" (
  "userId",
  "shopId",
  "sellerProfileId",
  "status",
  "businessType",
  "shopName",
  "shopSlug",
  "shopContactEmail",
  "shopContactPhone",
  "legalName",
  "contactEmail",
  "contactPhone",
  "submittedAt",
  "reviewedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  s."ownerId",
  s."id",
  s."sellerProfileId",
  CASE WHEN s."status" = 'ACTIVE' THEN 'APPROVED'::"SellerApplicationStatus" ELSE 'SUBMITTED'::"SellerApplicationStatus" END,
  sp."businessType",
  s."name",
  s."slug",
  s."contactEmail",
  s."contactPhone",
  COALESCE(sp."legalName", u."name"),
  COALESCE(sp."contactEmail", u."email"),
  COALESCE(sp."contactPhone", s."contactPhone", ''),
  s."createdAt",
  CASE WHEN s."status" = 'ACTIVE' THEN COALESCE(s."approvedAt", s."updatedAt") ELSE NULL END,
  s."createdAt",
  CURRENT_TIMESTAMP
FROM "Shop" s
JOIN "SellerProfile" sp ON sp."id" = s."sellerProfileId"
JOIN "User" u ON u."id" = s."ownerId"
ON CONFLICT ("shopId") DO NOTHING;

CREATE INDEX IF NOT EXISTS "SellerApplication_userId_status_idx" ON "SellerApplication" ("userId", "status");
CREATE INDEX IF NOT EXISTS "SellerApplication_status_submittedAt_idx" ON "SellerApplication" ("status", "submittedAt");
CREATE INDEX IF NOT EXISTS "SellerApplication_reviewedById_idx" ON "SellerApplication" ("reviewedById");
CREATE INDEX IF NOT EXISTS "SellerApplication_shopSlug_idx" ON "SellerApplication" ("shopSlug");
CREATE INDEX IF NOT EXISTS "SellerApplication_sellerProfileId_idx" ON "SellerApplication" ("sellerProfileId");

CREATE TABLE IF NOT EXISTS "SellerKycDocument" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "applicationId" uuid NOT NULL,
  "uploadId" uuid NOT NULL UNIQUE,
  "documentType" "SellerKycDocumentType" NOT NULL,
  "side" "SellerKycDocumentSide" NOT NULL DEFAULT 'FRONT',
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerKycDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SellerApplication"("id") ON DELETE CASCADE,
  CONSTRAINT "SellerKycDocument_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "SellerKycDocument_applicationId_documentType_side_key" ON "SellerKycDocument" ("applicationId", "documentType", "side");
CREATE INDEX IF NOT EXISTS "SellerKycDocument_applicationId_documentType_idx" ON "SellerKycDocument" ("applicationId", "documentType");

-- Return requests are now shop-scoped.
ALTER TABLE "ReturnRequest" ADD COLUMN IF NOT EXISTS "shopId" uuid;

UPDATE "ReturnRequest" rr
SET "shopId" = src."shopId"
FROM (
  SELECT
    ri."returnRequestId",
    MIN(oi."shopId") AS "shopId",
    COUNT(DISTINCT oi."shopId") AS "shopCount"
  FROM "ReturnItem" ri
  JOIN "OrderItem" oi ON oi."id" = ri."orderItemId"
  GROUP BY ri."returnRequestId"
) src
WHERE rr."id" = src."returnRequestId"
  AND src."shopCount" = 1
  AND rr."shopId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ReturnRequest" WHERE "shopId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill ReturnRequest.shopId for all rows. Mixed-shop or itemless returns require manual resolution.';
  END IF;
END $$;

ALTER TABLE "ReturnRequest" ALTER COLUMN "shopId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnRequest_shopId_fkey') THEN
    ALTER TABLE "ReturnRequest"
      ADD CONSTRAINT "ReturnRequest_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ReturnRequest_shopId_status_createdAt_idx" ON "ReturnRequest" ("shopId", "status", "createdAt");

-- Rename old SellerWallet table if present and align required wallet defaults.
DO $$
BEGIN
  IF to_regclass('"ShopWallet"') IS NULL AND to_regclass('"SellerWallet"') IS NOT NULL THEN
    ALTER TABLE "SellerWallet" RENAME TO "ShopWallet";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ShopWallet" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" uuid NOT NULL UNIQUE,
  "currency" text NOT NULL DEFAULT 'THB',
  "balance" bigint NOT NULL DEFAULT 0,
  "pendingBalance" bigint NOT NULL DEFAULT 0,
  "withdrawableBalance" bigint NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" integer NOT NULL DEFAULT 1,
  CONSTRAINT "ShopWallet_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE
);

ALTER TABLE "ShopWallet" ADD COLUMN IF NOT EXISTS "balance" bigint NOT NULL DEFAULT 0;
ALTER TABLE "ShopWallet" ADD COLUMN IF NOT EXISTS "pendingBalance" bigint NOT NULL DEFAULT 0;
ALTER TABLE "ShopWallet" ADD COLUMN IF NOT EXISTS "withdrawableBalance" bigint NOT NULL DEFAULT 0;
ALTER TABLE "ShopWallet" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
ALTER TABLE "ShopWallet" ALTER COLUMN "currency" SET DEFAULT 'THB';

INSERT INTO "ShopWallet" ("shopId", "currency", "createdAt", "updatedAt")
SELECT s."id", 'THB', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Shop" s
LEFT JOIN "ShopWallet" w ON w."shopId" = s."id"
WHERE w."id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ShopWallet_id_shopId_key" ON "ShopWallet" ("id", "shopId");
CREATE INDEX IF NOT EXISTS "ShopWallet_shopId_idx" ON "ShopWallet" ("shopId");

CREATE TABLE IF NOT EXISTS "ShopSetting" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" uuid NOT NULL UNIQUE,
  "autoAcceptOrder" boolean NOT NULL DEFAULT false,
  "allowCod" boolean NOT NULL DEFAULT false,
  "chatEnabled" boolean NOT NULL DEFAULT true,
  "vacationMode" boolean NOT NULL DEFAULT false,
  "defaultShippingProvider" text,
  "returnPolicy" text,
  "shippingPolicy" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" integer NOT NULL DEFAULT 1,
  CONSTRAINT "ShopSetting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE
);

INSERT INTO "ShopSetting" ("shopId", "createdAt", "updatedAt")
SELECT s."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Shop" s
LEFT JOIN "ShopSetting" ss ON ss."shopId" = s."id"
WHERE ss."id" IS NULL;

CREATE TABLE IF NOT EXISTS "ShopAddress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" uuid NOT NULL,
  "type" "ShopAddressType" NOT NULL DEFAULT 'PICKUP',
  "contactName" text NOT NULL,
  "phone" text,
  "line1" text NOT NULL,
  "line2" text,
  "city" text NOT NULL,
  "region" text,
  "postalCode" text NOT NULL,
  "country" text NOT NULL DEFAULT 'TH',
  "latitude" decimal(10, 7),
  "longitude" decimal(10, 7),
  "isDefault" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopAddress_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ShopAddress_shopId_type_idx" ON "ShopAddress" ("shopId", "type");
CREATE INDEX IF NOT EXISTS "ShopAddress_shopId_isDefault_idx" ON "ShopAddress" ("shopId", "isDefault");

INSERT INTO "ShopAddress" (
  "shopId",
  "type",
  "contactName",
  "phone",
  "line1",
  "city",
  "postalCode",
  "country",
  "isDefault",
  "createdAt",
  "updatedAt"
)
SELECT
  s."id",
  'PICKUP'::"ShopAddressType",
  COALESCE(u."name", s."name"),
  s."contactPhone",
  'BACKFILL_REQUIRED',
  'BACKFILL_REQUIRED',
  '00000',
  'TH',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Shop" s
JOIN "User" u ON u."id" = s."ownerId"
WHERE NOT EXISTS (
  SELECT 1
  FROM "ShopAddress" a
  WHERE a."shopId" = s."id"
    AND a."type" = 'PICKUP'
);

CREATE TABLE IF NOT EXISTS "ShopActivityLog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" uuid NOT NULL,
  "actorUserId" uuid,
  "action" "ShopActivityAction" NOT NULL,
  "entityType" text,
  "entityId" text,
  "before" jsonb,
  "after" jsonb,
  "metadata" jsonb,
  "ipAddress" text,
  "userAgent" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopActivityLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE,
  CONSTRAINT "ShopActivityLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ShopActivityLog_shopId_createdAt_idx" ON "ShopActivityLog" ("shopId", "createdAt");
CREATE INDEX IF NOT EXISTS "ShopActivityLog_actorUserId_createdAt_idx" ON "ShopActivityLog" ("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "ShopActivityLog_action_createdAt_idx" ON "ShopActivityLog" ("action", "createdAt");
CREATE INDEX IF NOT EXISTS "ShopActivityLog_entityType_entityId_idx" ON "ShopActivityLog" ("entityType", "entityId");

INSERT INTO "ShopActivityLog" ("shopId", "actorUserId", "action", "entityType", "entityId", "metadata")
SELECT
  s."id",
  s."ownerId",
  'SHOP_UPDATED'::"ShopActivityAction",
  'Shop',
  s."id"::text,
  jsonb_build_object('source', 'seller_identity_backfill')
FROM "Shop" s
WHERE NOT EXISTS (
  SELECT 1
  FROM "ShopActivityLog" l
  WHERE l."shopId" = s."id"
    AND l."entityType" = 'Shop'
    AND l."entityId" = s."id"::text
    AND l."metadata"->>'source' = 'seller_identity_backfill'
);

-- Convert User.role and any audit actorRole from USER/SELLER/ADMIN to USER/ADMIN.
UPDATE "User" SET "role" = 'USER'::"Role" WHERE "role"::text = 'SELLER';

DO $$
BEGIN
  IF to_regclass('"AuditLog"') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AuditLog'
      AND column_name = 'actorRole'
  ) THEN
    UPDATE "AuditLog" SET "actorRole" = 'USER'::"Role" WHERE "actorRole"::text = 'SELLER';
  END IF;
END $$;

DO $$
DECLARE
  role_labels text[];
BEGIN
  SELECT array_agg(enumlabel ORDER BY enumsortorder)
    INTO role_labels
  FROM pg_enum
  WHERE enumtypid = '"Role"'::regtype;

  IF role_labels @> ARRAY['SELLER'] THEN
    ALTER TYPE "Role" RENAME TO "Role_old";
    CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

    ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
    ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

    IF to_regclass('"AuditLog"') IS NOT NULL AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'AuditLog'
        AND column_name = 'actorRole'
    ) THEN
      ALTER TABLE "AuditLog" ALTER COLUMN "actorRole" TYPE "Role" USING "actorRole"::text::"Role";
    END IF;

    DROP TYPE "Role_old";
  END IF;
END $$;

-- Final safety checks for the issue acceptance criteria.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "_seller_identity_former_sellers" fs
    LEFT JOIN "SellerProfile" sp ON sp."userId" = fs."userId"
    WHERE sp."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'SellerProfile backfill incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Shop" s
    LEFT JOIN "SellerProfile" sp ON sp."id" = s."sellerProfileId"
    WHERE sp."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Shop sellerProfileId backfill incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Shop" s
    LEFT JOIN "ShopWallet" w ON w."shopId" = s."id"
    WHERE w."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'ShopWallet backfill incomplete';
  END IF;
END $$;

COMMIT;
