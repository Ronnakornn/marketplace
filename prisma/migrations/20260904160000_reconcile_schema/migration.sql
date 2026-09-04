-- Baseline reconciliation only: populated legacy databases require a reviewed staged data migration.
DO $$
DECLARE
  application_table RECORD;
  has_rows BOOLEAN;
BEGIN
  FOR application_table IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I LIMIT 1)', current_schema(), application_table.tablename) INTO has_rows;
    IF has_rows THEN
      RAISE EXCEPTION '20260904160000_reconcile_schema is baseline-only; table % contains data. Follow the deployment runbook', application_table.tablename;
    END IF;
  END LOOP;
END $$;

-- CreateEnum
CREATE TYPE "PhoneOtpPurpose" AS ENUM ('PHONE_LOGIN', 'PHONE_SIGNUP', 'PHONE_LINK');

-- CreateEnum
CREATE TYPE "ShopStaffStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ShopStaffRoleType" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'SUPPORT', 'WAREHOUSE', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "SellerViolationType" AS ENUM ('DUPLICATE_PRODUCT', 'PROHIBITED_PRODUCT', 'FAKE_REVIEW', 'LATE_SHIPMENT', 'CANCELLATION_ABUSE', 'REFUND_ABUSE', 'POLICY_VIOLATION', 'FRAUD_RISK', 'OTHER');

-- CreateEnum
CREATE TYPE "SellerViolationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SellerViolationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ShopRestrictionType" AS ENUM ('LISTING_DISABLED', 'CHECKOUT_DISABLED', 'PAYOUT_HOLD', 'CHAT_DISABLED', 'VISIBILITY_LIMITED', 'FULL_SUSPENSION');

-- CreateEnum
CREATE TYPE "SellerTransactionType" AS ENUM ('ORDER_EARNING', 'COMMISSION_FEE', 'PAYOUT_RESERVED', 'PAYOUT_PAID', 'PAYOUT_REJECTED', 'REFUND_ADJUSTMENT', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SellerTransactionStatus" AS ENUM ('PENDING', 'AVAILABLE', 'RESERVED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CategoryAttributeValueType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT');

-- CreateEnum
CREATE TYPE "ProductDuplicateStatus" AS ENUM ('UNKNOWN', 'UNIQUE', 'SUSPECTED_DUPLICATE', 'BLOCKED_DUPLICATE', 'APPROVED_EXCEPTION');

-- CreateEnum
CREATE TYPE "ProductDuplicateReviewStatus" AS ENUM ('OPEN', 'APPROVED_DUPLICATE', 'REJECTED_NOT_DUPLICATE', 'APPROVED_EXCEPTION', 'CLOSED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('ADJUSTMENT', 'RESERVATION_CREATED', 'RESERVATION_RELEASED', 'RESERVATION_COMMITTED', 'SALE_COMMITTED', 'RETURN_RESTOCK');

-- CreateEnum
CREATE TYPE "ReviewMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ReviewReportReason" AS ENUM ('SPAM', 'ABUSIVE_LANGUAGE', 'ADULT_CONTENT', 'FAKE_REVIEW', 'IRRELEVANT', 'PERSONAL_INFO', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_REMOVED', 'RESOLVED_DISMISSED', 'RESOLVED_HIDDEN');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "MarketingBannerStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketingPlacement" AS ENUM ('HOME_HERO', 'HOME_POPUP', 'HOME_HIGHLIGHT', 'CATEGORY_HERO', 'SEARCH_TOP');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'PENDING_CUSTOMER', 'PENDING_SELLER', 'PENDING_ADMIN', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketMessageSenderType" AS ENUM ('BUYER', 'SELLER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DisputeCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'WAITING_EVIDENCE', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'COMPENSATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProductQuestionStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProductAnswerStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED');

-- CreateEnum
CREATE TYPE "FeatureToggleScope" AS ENUM ('GLOBAL', 'SHOP', 'USER');

-- CreateEnum
CREATE TYPE "NotificationTemplateChannel" AS ENUM ('EMAIL', 'SMS', 'LINE', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "ReportExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReportExportFormat" AS ENUM ('CSV', 'XLSX', 'PDF');

-- CreateEnum
CREATE TYPE "AnalyticsEntityType" AS ENUM ('PRODUCT', 'SHOP', 'CATEGORY', 'SEARCH');

-- CreateEnum
CREATE TYPE "ModerationEntityType" AS ENUM ('PRODUCT', 'SHOP', 'REVIEW', 'SHOP_REVIEW', 'CHAT_MESSAGE', 'PRODUCT_QUESTION', 'PRODUCT_ANSWER', 'USER');

-- CreateEnum
CREATE TYPE "ModerationCaseReason" AS ENUM ('USER_REPORT', 'PROHIBITED_PRODUCT', 'FAKE_REVIEW', 'SPAM', 'ABUSIVE_CONTENT', 'FRAUD_RISK', 'POLICY_VIOLATION', 'SYSTEM_FLAG', 'OTHER');

-- CreateEnum
CREATE TYPE "ModerationCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('APPROVE', 'REJECT', 'HIDE', 'UNHIDE', 'SUSPEND', 'RESTORE', 'ESCALATE', 'NOTE');

-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('PAYMENT', 'SHIPPING', 'SMS', 'EMAIL', 'LINE', 'OTHER');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "IntegrationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "IntegrationLogStatus" AS ENUM ('SUCCESS', 'FAILED', 'RETRYING', 'SKIPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'REVIEW_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'REVIEW_REPORT_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'PRODUCT_QUESTION_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'PRODUCT_ANSWER_STATUS_CHANGED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductStatus" ADD VALUE 'REJECTED';
ALTER TYPE "ProductStatus" ADD VALUE 'SUSPENDED';

-- AlterEnum
ALTER TYPE "ReviewStatus" ADD VALUE 'HIDDEN';

-- AlterEnum
ALTER TYPE "UploadUsage" ADD VALUE 'PRODUCT_VIDEO';

-- DropForeignKey
ALTER TABLE "ChatThread" DROP CONSTRAINT "ChatThread_orderId_fkey";

-- DropForeignKey
ALTER TABLE "ChatThread" DROP CONSTRAINT "ChatThread_productId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryReservation" DROP CONSTRAINT "InventoryReservation_variantId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_sellerProfileId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnRequest" DROP CONSTRAINT "ReturnRequest_shopId_fkey";

-- DropForeignKey
ALTER TABLE "SellerApplication" DROP CONSTRAINT "SellerApplication_reviewedById_fkey";

-- DropForeignKey
ALTER TABLE "SellerApplication" DROP CONSTRAINT "SellerApplication_sellerProfileId_fkey";

-- DropForeignKey
ALTER TABLE "SellerApplication" DROP CONSTRAINT "SellerApplication_shopId_fkey";

-- DropForeignKey
ALTER TABLE "SellerApplication" DROP CONSTRAINT "SellerApplication_userId_fkey";

-- DropForeignKey
ALTER TABLE "SellerKycDocument" DROP CONSTRAINT "SellerKycDocument_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "SellerKycDocument" DROP CONSTRAINT "SellerKycDocument_uploadId_fkey";

-- DropForeignKey
ALTER TABLE "SellerPayout" DROP CONSTRAINT "SellerPayout_walletId_fkey";

-- DropForeignKey
ALTER TABLE "SellerProfile" DROP CONSTRAINT "SellerProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "Shop" DROP CONSTRAINT "Shop_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "Shop" DROP CONSTRAINT "Shop_sellerProfileId_fkey";

-- DropForeignKey
ALTER TABLE "ShopActivityLog" DROP CONSTRAINT "ShopActivityLog_actorUserId_fkey";

-- DropForeignKey
ALTER TABLE "ShopActivityLog" DROP CONSTRAINT "ShopActivityLog_shopId_fkey";

-- DropForeignKey
ALTER TABLE "ShopAddress" DROP CONSTRAINT "ShopAddress_shopId_fkey";

-- DropForeignKey
ALTER TABLE "ShopSetting" DROP CONSTRAINT "ShopSetting_shopId_fkey";

-- DropForeignKey
ALTER TABLE "WalletLedgerEntry" DROP CONSTRAINT "WalletLedgerEntry_walletId_fkey";

-- DropIndex
DROP INDEX "ChatThread_buyerId_createdAt_idx";

-- DropIndex
DROP INDEX "ChatThread_orderId_idx";

-- DropIndex
DROP INDEX "ChatThread_productId_idx";

-- DropIndex
DROP INDEX "ChatThread_shopId_createdAt_idx";

-- DropIndex
DROP INDEX "FraudCase_reviewedBy_idx";

-- DropIndex
DROP INDEX "InventoryReservation_checkoutId_variantId_idx";

-- DropIndex
DROP INDEX "InventoryReservation_variantId_status_idx";

-- DropIndex
DROP INDEX "Product_shopId_slug_key";

-- DropIndex
DROP INDEX "ProductVariant_sku_key";

-- DropIndex
DROP INDEX "Review_productId_status_idx";

-- DropIndex
DROP INDEX "Review_userId_idx";

-- DropIndex
DROP INDEX "Shop_slug_key";

-- AlterTable
ALTER TABLE "AffiliateCommission" DROP COLUMN "commissionCents",
ADD COLUMN     "commission" BIGINT NOT NULL,
ALTER COLUMN "eligiblesubtotal" SET DATA TYPE BIGINT,
ALTER COLUMN "currency" SET DEFAULT 'THB';

-- AlterTable
ALTER TABLE "CartItem" ALTER COLUMN "unitPrice" SET DATA TYPE BIGINT,
ALTER COLUMN "currency" SET DEFAULT 'THB';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "parentId" UUID;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "orderId" UUID,
ADD COLUMN     "productId" UUID;

-- AlterTable
ALTER TABLE "ChatThread" DROP COLUMN "orderId",
DROP COLUMN "productId",
ADD COLUMN     "lastMessageAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Checkout" ALTER COLUMN "subtotal" SET DATA TYPE BIGINT,
ALTER COLUMN "discountTotal" SET DATA TYPE BIGINT,
ALTER COLUMN "shippingTotal" SET DATA TYPE BIGINT,
ALTER COLUMN "taxTotal" SET DATA TYPE BIGINT,
ALTER COLUMN "grandTotal" SET DATA TYPE BIGINT,
ALTER COLUMN "currency" SET DEFAULT 'THB';

-- AlterTable
ALTER TABLE "Coupon" DROP COLUMN "discountValueCents",
DROP COLUMN "maxDiscountCents",
DROP COLUMN "minOrderCents",
ADD COLUMN     "discountValue" BIGINT,
ADD COLUMN     "maxDiscount" BIGINT,
ADD COLUMN     "minOrder" BIGINT;

-- AlterTable
ALTER TABLE "FraudCase" DROP COLUMN "resolvedBy",
DROP COLUMN "reviewedBy",
ADD COLUMN     "resolvedById" UUID,
ADD COLUMN     "reviewedById" UUID;

-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "InventoryReservation" DROP COLUMN "variantId",
ADD COLUMN     "inventoryId" UUID NOT NULL,
ADD COLUMN     "orderId" UUID,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "subtotal" SET DATA TYPE BIGINT,
ALTER COLUMN "discountTotal" SET DATA TYPE BIGINT,
ALTER COLUMN "shippingTotal" SET DATA TYPE BIGINT,
ALTER COLUMN "taxTotal" SET DATA TYPE BIGINT,
ALTER COLUMN "grandTotal" SET DATA TYPE BIGINT,
ALTER COLUMN "currency" SET DEFAULT 'THB';

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "unitPrice" SET DATA TYPE BIGINT,
ALTER COLUMN "lineTotal" SET DATA TYPE BIGINT,
ALTER COLUMN "currency" SET DEFAULT 'THB';

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brandId" UUID,
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "countryOfOrigin" TEXT,
ADD COLUMN     "duplicateOfProductId" UUID,
ADD COLUMN     "duplicateStatus" "ProductDuplicateStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaTitle" TEXT,
ADD COLUMN     "productFingerprintHash" TEXT,
ADD COLUMN     "warrantyInfo" TEXT;

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "prices",
ADD COLUMN     "heightMm" INTEGER,
ADD COLUMN     "lengthMm" INTEGER,
ADD COLUMN     "optionCombinationKey" TEXT,
ADD COLUMN     "price" BIGINT NOT NULL,
ADD COLUMN     "weightGrams" INTEGER,
ADD COLUMN     "widthMm" INTEGER,
ALTER COLUMN "currency" SET DEFAULT 'THB';

-- AlterTable
ALTER TABLE "Refund" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "images",
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderationReason" TEXT;

-- AlterTable
ALTER TABLE "SellerApplication" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "bankName" DROP DEFAULT,
ALTER COLUMN "bankAccountName" DROP DEFAULT,
ALTER COLUMN "bankAccountNumberEncrypted" DROP DEFAULT,
ALTER COLUMN "bankAccountNumberLast4" DROP DEFAULT,
ALTER COLUMN "pickupName" DROP DEFAULT,
ALTER COLUMN "pickupLine1" DROP DEFAULT,
ALTER COLUMN "pickupCity" DROP DEFAULT,
ALTER COLUMN "pickupPostalCode" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SellerKycDocument" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SellerPayout" ALTER COLUMN "amount" SET DATA TYPE BIGINT,
ALTER COLUMN "currency" SET DEFAULT 'THB';

-- AlterTable
ALTER TABLE "SellerProfile" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "providerId" UUID;

-- AlterTable
ALTER TABLE "ShopActivityLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShopAddress" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShopSetting" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShopWallet" RENAME CONSTRAINT "SellerWallet_pkey" TO "ShopWallet_pkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" VARCHAR(32),
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WalletLedgerEntry" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "amount" SET DATA TYPE BIGINT,
ALTER COLUMN "currency" SET DEFAULT 'THB';

-- CreateTable
CREATE TABLE "DeviceAccount" (
    "id" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "DeviceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneOtpChallenge" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "purpose" "PhoneOtpPurpose" NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryAttributeDefinition" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayNameTh" TEXT,
    "displayNameEn" TEXT,
    "valueType" "CategoryAttributeValueType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "unit" TEXT,
    "allowedValues" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryAttributeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameTh" TEXT,
    "nameEn" TEXT,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "descriptionTh" TEXT,
    "descriptionEn" TEXT,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "countryCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameTh" TEXT,
    "nameEn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOptionValue" (
    "id" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "valueTh" TEXT,
    "valueEn" TEXT,
    "displayType" TEXT NOT NULL DEFAULT 'TEXT',
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOptionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariantOptionValue" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "optionValueId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVariantOptionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductHighlight" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayNameTh" TEXT,
    "displayNameEn" TEXT,
    "value" TEXT NOT NULL,
    "valueTh" TEXT,
    "valueEn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "uploadId" UUID,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVideo" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "uploadId" UUID,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopStaff" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ShopStaffRoleType" NOT NULL DEFAULT 'SUPPORT',
    "status" "ShopStaffStatus" NOT NULL DEFAULT 'INVITED',
    "invitedById" UUID,
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShopStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopStaffPermission" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopStaffPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopRating" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "shopOrderId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "moderatedAt" TIMESTAMP(3),
    "moderatedById" UUID,
    "moderationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopDailyStats" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalSales" BIGINT NOT NULL DEFAULT 0,
    "totalVisitors" INTEGER NOT NULL DEFAULT 0,
    "totalProductsSold" INTEGER NOT NULL DEFAULT 0,
    "conversionRateBps" INTEGER NOT NULL DEFAULT 0,
    "ratingAverage" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopDailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDuplicateReview" (
    "id" UUID NOT NULL,
    "sourceProductId" UUID NOT NULL,
    "candidateProductId" UUID NOT NULL,
    "reportedByShopId" UUID NOT NULL,
    "reportedByUserId" UUID,
    "reviewedById" UUID,
    "status" "ProductDuplicateReviewStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "metadata" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDuplicateReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "quantityOnHandBefore" INTEGER NOT NULL,
    "quantityOnHandAfter" INTEGER NOT NULL,
    "quantityReservedBefore" INTEGER NOT NULL,
    "quantityReservedAfter" INTEGER NOT NULL,
    "actorUserId" UUID,
    "reason" TEXT,
    "referenceType" TEXT,
    "referenceId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrder" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "discountTotal" BIGINT NOT NULL DEFAULT 0,
    "shippingTotal" BIGINT NOT NULL DEFAULT 0,
    "taxTotal" BIGINT NOT NULL DEFAULT 0,
    "grandTotal" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ShopOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewMedia" (
    "id" UUID NOT NULL,
    "reviewId" UUID,
    "shopRatingId" UUID,
    "uploadedById" UUID,
    "type" "ReviewMediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" INTEGER,
    "sizeBytes" INTEGER,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewReport" (
    "id" UUID NOT NULL,
    "reviewId" UUID,
    "shopRatingId" UUID,
    "reportedById" UUID NOT NULL,
    "moderatedById" UUID,
    "reason" "ReviewReportReason" NOT NULL,
    "detail" TEXT,
    "status" "ReviewReportStatus" NOT NULL DEFAULT 'OPEN',
    "moderationNote" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerTransaction" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "sellerProfileId" UUID,
    "shopId" UUID NOT NULL,
    "type" "SellerTransactionType" NOT NULL,
    "status" "SellerTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "orderId" UUID,
    "payoutId" UUID,
    "refundId" UUID,
    "reference" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "availableAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerViolation" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "createdById" UUID,
    "type" "SellerViolationType" NOT NULL,
    "severity" "SellerViolationSeverity" NOT NULL DEFAULT 'LOW',
    "status" "SellerViolationStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopRestriction" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "createdById" UUID,
    "type" "ShopRestrictionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatThreadReadState" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatThreadReadState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "userId" UUID,
    "scope" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" JSONB,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" TIMESTAMP(3),

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingProvider" (
    "id" UUID NOT NULL,
    "shopId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayNameTh" TEXT,
    "displayNameEn" TEXT,
    "apiProvider" TEXT,
    "apiConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supportsCod" BOOLEAN NOT NULL DEFAULT false,
    "supportsPickup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingBanner" (
    "id" UUID NOT NULL,
    "placement" "MarketingPlacement" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT NOT NULL,
    "mobileImageUrl" TEXT,
    "targetUrl" TEXT,
    "status" "MarketingBannerStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "shopId" UUID,
    "orderId" UUID,
    "subject" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "senderId" UUID,
    "senderType" "TicketMessageSenderType" NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeCase" (
    "id" UUID NOT NULL,
    "ticketId" UUID,
    "orderId" UUID,
    "openedById" UUID NOT NULL,
    "status" "DisputeCaseStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "decision" TEXT,
    "compensation" BIGINT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductQuestion" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "status" "ProductQuestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAnswer" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "answer" TEXT NOT NULL,
    "status" "ProductAnswerStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureToggle" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "scope" "FeatureToggleScope" NOT NULL DEFAULT 'GLOBAL',
    "scopeId" UUID,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureToggle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "channel" "NotificationTemplateChannel" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'th',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExportJob" (
    "id" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "format" "ReportExportFormat" NOT NULL DEFAULT 'XLSX',
    "status" "ReportExportStatus" NOT NULL DEFAULT 'QUEUED',
    "filters" JSONB,
    "fileUrl" TEXT,
    "error" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchQueryLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "sessionId" TEXT,
    "query" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "clickedEntityType" "AnalyticsEntityType",
    "clickedEntityId" UUID,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductViewLog" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "userId" UUID,
    "sessionId" TEXT,
    "source" TEXT,
    "referrer" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductViewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAddToCartLog" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "userId" UUID,
    "sessionId" TEXT,
    "quantity" INTEGER NOT NULL,
    "source" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAddToCartLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationCase" (
    "id" UUID NOT NULL,
    "entityType" "ModerationEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "reason" "ModerationCaseReason" NOT NULL,
    "status" "ModerationCaseStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "SellerViolationSeverity" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT,
    "description" TEXT,
    "evidence" JSONB,
    "sourceReportId" UUID,
    "createdById" UUID,
    "assignedToId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" UUID NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "idempotencyKey" TEXT,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "signatureHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processedById" UUID,
    "processedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" UUID NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "direction" "IntegrationDirection" NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "IntegrationLogStatus" NOT NULL,
    "requestId" TEXT,
    "relatedType" TEXT,
    "relatedId" UUID,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "statusCode" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceAccount_deviceId_revokedAt_idx" ON "DeviceAccount"("deviceId", "revokedAt");

-- CreateIndex
CREATE INDEX "DeviceAccount_userId_revokedAt_idx" ON "DeviceAccount"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAccount_deviceId_userId_key" ON "DeviceAccount"("deviceId", "userId");

-- CreateIndex
CREATE INDEX "PhoneOtpChallenge_phone_idx" ON "PhoneOtpChallenge"("phone");

-- CreateIndex
CREATE INDEX "PhoneOtpChallenge_purpose_idx" ON "PhoneOtpChallenge"("purpose");

-- CreateIndex
CREATE INDEX "PhoneOtpChallenge_expiresAt_idx" ON "PhoneOtpChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "PhoneOtpChallenge_phone_purpose_consumedAt_revokedAt_expire_idx" ON "PhoneOtpChallenge"("phone", "purpose", "consumedAt", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "CategoryAttributeDefinition_categoryId_isActive_sortOrder_idx" ON "CategoryAttributeDefinition"("categoryId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "CategoryAttributeDefinition_categoryId_sortOrder_idx" ON "CategoryAttributeDefinition"("categoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "CategoryAttributeDefinition_categoryId_isRequired_idx" ON "CategoryAttributeDefinition"("categoryId", "isRequired");

-- CreateIndex
CREATE INDEX "CategoryAttributeDefinition_categoryId_isFilterable_idx" ON "CategoryAttributeDefinition"("categoryId", "isFilterable");

-- CreateIndex
CREATE INDEX "CategoryAttributeDefinition_categoryId_isActive_isRequired_idx" ON "CategoryAttributeDefinition"("categoryId", "isActive", "isRequired");

-- CreateIndex
CREATE INDEX "CategoryAttributeDefinition_categoryId_isActive_isFilterabl_idx" ON "CategoryAttributeDefinition"("categoryId", "isActive", "isFilterable", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAttributeDefinition_categoryId_attributeKey_key" ON "CategoryAttributeDefinition"("categoryId", "attributeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_code_key" ON "Brand"("code");

-- CreateIndex
CREATE INDEX "Brand_isActive_sortOrder_idx" ON "Brand"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Brand_isActive_isFeatured_sortOrder_idx" ON "Brand"("isActive", "isFeatured", "sortOrder");

-- CreateIndex
CREATE INDEX "Brand_isActive_name_idx" ON "Brand"("isActive", "name");

-- CreateIndex
CREATE INDEX "Brand_isActive_nameTh_idx" ON "Brand"("isActive", "nameTh");

-- CreateIndex
CREATE INDEX "Brand_isActive_nameEn_idx" ON "Brand"("isActive", "nameEn");

-- CreateIndex
CREATE INDEX "Brand_isActive_slug_idx" ON "Brand"("isActive", "slug");

-- CreateIndex
CREATE INDEX "Brand_countryCode_isActive_idx" ON "Brand"("countryCode", "isActive");

-- CreateIndex
CREATE INDEX "ProductOption_productId_sortOrder_idx" ON "ProductOption"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_productId_name_key" ON "ProductOption"("productId", "name");

-- CreateIndex
CREATE INDEX "ProductOptionValue_optionId_sortOrder_idx" ON "ProductOptionValue"("optionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOptionValue_optionId_value_key" ON "ProductOptionValue"("optionId", "value");

-- CreateIndex
CREATE INDEX "ProductVariantOptionValue_variantId_idx" ON "ProductVariantOptionValue"("variantId");

-- CreateIndex
CREATE INDEX "ProductVariantOptionValue_optionValueId_idx" ON "ProductVariantOptionValue"("optionValueId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantOptionValue_variantId_optionValueId_key" ON "ProductVariantOptionValue"("variantId", "optionValueId");

-- CreateIndex
CREATE INDEX "ProductHighlight_productId_sortOrder_idx" ON "ProductHighlight"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductAttribute_productId_sortOrder_idx" ON "ProductAttribute"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductAttribute_attributeKey_value_idx" ON "ProductAttribute"("attributeKey", "value");

-- CreateIndex
CREATE INDEX "ProductAttribute_isFilterable_attributeKey_value_idx" ON "ProductAttribute"("isFilterable", "attributeKey", "value");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttribute_productId_attributeKey_key" ON "ProductAttribute"("productId", "attributeKey");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_createdAt_idx" ON "ProductImage"("productId", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "ProductImage_productId_isPrimary_idx" ON "ProductImage"("productId", "isPrimary");

-- CreateIndex
CREATE INDEX "ProductImage_uploadId_idx" ON "ProductImage"("uploadId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_uploadId_key" ON "ProductImage"("uploadId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVideo_productId_key" ON "ProductVideo"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVideo_uploadId_key" ON "ProductVideo"("uploadId");

-- CreateIndex
CREATE INDEX "ProductVideo_productId_sortOrder_createdAt_idx" ON "ProductVideo"("productId", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "ProductVideo_uploadId_idx" ON "ProductVideo"("uploadId");

-- CreateIndex
CREATE INDEX "ShopStaff_shopId_role_status_idx" ON "ShopStaff"("shopId", "role", "status");

-- CreateIndex
CREATE INDEX "ShopStaff_userId_status_idx" ON "ShopStaff"("userId", "status");

-- CreateIndex
CREATE INDEX "ShopStaff_invitedById_idx" ON "ShopStaff"("invitedById");

-- CreateIndex
CREATE UNIQUE INDEX "ShopStaff_shopId_userId_key" ON "ShopStaff"("shopId", "userId");

-- CreateIndex
CREATE INDEX "ShopStaffPermission_permission_idx" ON "ShopStaffPermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "ShopStaffPermission_staffId_permission_key" ON "ShopStaffPermission"("staffId", "permission");

-- CreateIndex
CREATE INDEX "ShopRating_shopId_status_createdAt_idx" ON "ShopRating"("shopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopRating_shopId_status_updatedAt_idx" ON "ShopRating"("shopId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ShopRating_userId_createdAt_idx" ON "ShopRating"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopRating_shopOrderId_idx" ON "ShopRating"("shopOrderId");

-- CreateIndex
CREATE INDEX "ShopRating_status_moderatedAt_idx" ON "ShopRating"("status", "moderatedAt");

-- CreateIndex
CREATE INDEX "ShopRating_moderatedById_idx" ON "ShopRating"("moderatedById");

-- CreateIndex
CREATE UNIQUE INDEX "ShopRating_shopId_userId_shopOrderId_key" ON "ShopRating"("shopId", "userId", "shopOrderId");

-- CreateIndex
CREATE INDEX "ShopDailyStats_date_idx" ON "ShopDailyStats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ShopDailyStats_shopId_date_key" ON "ShopDailyStats"("shopId", "date");

-- CreateIndex
CREATE INDEX "ProductDuplicateReview_sourceProductId_idx" ON "ProductDuplicateReview"("sourceProductId");

-- CreateIndex
CREATE INDEX "ProductDuplicateReview_candidateProductId_idx" ON "ProductDuplicateReview"("candidateProductId");

-- CreateIndex
CREATE INDEX "ProductDuplicateReview_reportedByShopId_status_idx" ON "ProductDuplicateReview"("reportedByShopId", "status");

-- CreateIndex
CREATE INDEX "ProductDuplicateReview_reportedByUserId_idx" ON "ProductDuplicateReview"("reportedByUserId");

-- CreateIndex
CREATE INDEX "ProductDuplicateReview_reviewedById_idx" ON "ProductDuplicateReview"("reviewedById");

-- CreateIndex
CREATE INDEX "ProductDuplicateReview_status_createdAt_idx" ON "ProductDuplicateReview"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDuplicateReview_sourceProductId_candidateProductId_key" ON "ProductDuplicateReview"("sourceProductId", "candidateProductId");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryId_createdAt_idx" ON "InventoryMovement"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_variantId_createdAt_idx" ON "InventoryMovement"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_actorUserId_createdAt_idx" ON "InventoryMovement"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_type_createdAt_idx" ON "InventoryMovement"("type", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx" ON "InventoryMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "ShopOrder_shopId_fulfillmentStatus_createdAt_idx" ON "ShopOrder"("shopId", "fulfillmentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrder_shopId_status_fulfillmentStatus_createdAt_idx" ON "ShopOrder"("shopId", "status", "fulfillmentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrder_shopId_status_createdAt_idx" ON "ShopOrder"("shopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrder_shopId_fulfillmentStatus_idx" ON "ShopOrder"("shopId", "fulfillmentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_orderId_shopId_key" ON "ShopOrder"("orderId", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_id_shopId_key" ON "ShopOrder"("id", "shopId");

-- CreateIndex
CREATE INDEX "ReviewMedia_reviewId_sortOrder_idx" ON "ReviewMedia"("reviewId", "sortOrder");

-- CreateIndex
CREATE INDEX "ReviewMedia_shopRatingId_sortOrder_idx" ON "ReviewMedia"("shopRatingId", "sortOrder");

-- CreateIndex
CREATE INDEX "ReviewMedia_type_idx" ON "ReviewMedia"("type");

-- CreateIndex
CREATE INDEX "ReviewReport_reviewId_status_idx" ON "ReviewReport"("reviewId", "status");

-- CreateIndex
CREATE INDEX "ReviewReport_shopRatingId_status_idx" ON "ReviewReport"("shopRatingId", "status");

-- CreateIndex
CREATE INDEX "ReviewReport_reportedById_createdAt_idx" ON "ReviewReport"("reportedById", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewReport_status_createdAt_idx" ON "ReviewReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SellerTransaction_walletId_createdAt_idx" ON "SellerTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "SellerTransaction_sellerProfileId_createdAt_idx" ON "SellerTransaction"("sellerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "SellerTransaction_shopId_createdAt_idx" ON "SellerTransaction"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "SellerTransaction_type_status_idx" ON "SellerTransaction"("type", "status");

-- CreateIndex
CREATE INDEX "SellerTransaction_orderId_idx" ON "SellerTransaction"("orderId");

-- CreateIndex
CREATE INDEX "SellerTransaction_payoutId_idx" ON "SellerTransaction"("payoutId");

-- CreateIndex
CREATE INDEX "SellerTransaction_refundId_idx" ON "SellerTransaction"("refundId");

-- CreateIndex
CREATE INDEX "SellerViolation_shopId_status_createdAt_idx" ON "SellerViolation"("shopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SellerViolation_shopId_type_createdAt_idx" ON "SellerViolation"("shopId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "SellerViolation_severity_status_idx" ON "SellerViolation"("severity", "status");

-- CreateIndex
CREATE INDEX "SellerViolation_createdById_idx" ON "SellerViolation"("createdById");

-- CreateIndex
CREATE INDEX "ShopRestriction_shopId_type_startsAt_idx" ON "ShopRestriction"("shopId", "type", "startsAt");

-- CreateIndex
CREATE INDEX "ShopRestriction_shopId_revokedAt_endsAt_idx" ON "ShopRestriction"("shopId", "revokedAt", "endsAt");

-- CreateIndex
CREATE INDEX "ShopRestriction_type_startsAt_idx" ON "ShopRestriction"("type", "startsAt");

-- CreateIndex
CREATE INDEX "ShopRestriction_createdById_idx" ON "ShopRestriction"("createdById");

-- CreateIndex
CREATE INDEX "InternalNote_entityType_entityId_createdAt_idx" ON "InternalNote"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "InternalNote_entityType_entityId_isPinned_idx" ON "InternalNote"("entityType", "entityId", "isPinned");

-- CreateIndex
CREATE INDEX "InternalNote_createdById_createdAt_idx" ON "InternalNote"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "ChatThreadReadState_userId_readAt_idx" ON "ChatThreadReadState"("userId", "readAt");

-- CreateIndex
CREATE INDEX "ChatThreadReadState_threadId_readAt_idx" ON "ChatThreadReadState"("threadId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatThreadReadState_threadId_userId_key" ON "ChatThreadReadState"("threadId", "userId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_userId_idx" ON "IdempotencyKey"("userId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiredAt_idx" ON "IdempotencyKey"("expiredAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_scope_key_key" ON "IdempotencyKey"("scope", "key");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_nextRetryAt_idx" ON "OutboxEvent"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "OutboxEvent_eventType_createdAt_idx" ON "OutboxEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "ShippingProvider_shopId_isActive_idx" ON "ShippingProvider"("shopId", "isActive");

-- CreateIndex
CREATE INDEX "ShippingProvider_code_idx" ON "ShippingProvider"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingProvider_shopId_code_key" ON "ShippingProvider"("shopId", "code");

-- CreateIndex
CREATE INDEX "MarketingBanner_placement_status_startsAt_endsAt_sortOrder_idx" ON "MarketingBanner"("placement", "status", "startsAt", "endsAt", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketingBanner_placement_status_sortOrder_idx" ON "MarketingBanner"("placement", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketingBanner_startsAt_endsAt_idx" ON "MarketingBanner"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "SupportTicket_shopId_status_priority_updatedAt_idx" ON "SupportTicket"("shopId", "status", "priority", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_shopId_status_idx" ON "SupportTicket"("shopId", "status");

-- CreateIndex
CREATE INDEX "SupportTicket_orderId_idx" ON "SupportTicket"("orderId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_priority_updatedAt_idx" ON "SupportTicket"("status", "priority", "updatedAt");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketMessage_senderId_idx" ON "TicketMessage"("senderId");

-- CreateIndex
CREATE INDEX "DisputeCase_ticketId_idx" ON "DisputeCase"("ticketId");

-- CreateIndex
CREATE INDEX "DisputeCase_orderId_status_idx" ON "DisputeCase"("orderId", "status");

-- CreateIndex
CREATE INDEX "DisputeCase_openedById_createdAt_idx" ON "DisputeCase"("openedById", "createdAt");

-- CreateIndex
CREATE INDEX "DisputeCase_status_updatedAt_idx" ON "DisputeCase"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ProductQuestion_shopId_status_createdAt_idx" ON "ProductQuestion"("shopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductQuestion_productId_status_createdAt_idx" ON "ProductQuestion"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductQuestion_shopId_status_idx" ON "ProductQuestion"("shopId", "status");

-- CreateIndex
CREATE INDEX "ProductQuestion_userId_createdAt_idx" ON "ProductQuestion"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductAnswer_questionId_status_createdAt_idx" ON "ProductAnswer"("questionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductAnswer_userId_createdAt_idx" ON "ProductAnswer"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureToggle_scope_scopeId_isEnabled_idx" ON "FeatureToggle"("scope", "scopeId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureToggle_key_scope_scopeId_key" ON "FeatureToggle"("key", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_channel_isActive_idx" ON "NotificationTemplate"("channel", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_key_channel_locale_key" ON "NotificationTemplate"("key", "channel", "locale");

-- CreateIndex
CREATE INDEX "ReportExportJob_requestedById_createdAt_idx" ON "ReportExportJob"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "ReportExportJob_type_status_createdAt_idx" ON "ReportExportJob"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReportExportJob_status_createdAt_idx" ON "ReportExportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SearchQueryLog_normalizedQuery_createdAt_idx" ON "SearchQueryLog"("normalizedQuery", "createdAt");

-- CreateIndex
CREATE INDEX "SearchQueryLog_userId_createdAt_idx" ON "SearchQueryLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchQueryLog_sessionId_createdAt_idx" ON "SearchQueryLog"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchQueryLog_clickedEntityType_clickedEntityId_idx" ON "SearchQueryLog"("clickedEntityType", "clickedEntityId");

-- CreateIndex
CREATE INDEX "SearchQueryLog_createdAt_idx" ON "SearchQueryLog"("createdAt");

-- CreateIndex
CREATE INDEX "ProductViewLog_productId_createdAt_idx" ON "ProductViewLog"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductViewLog_shopId_createdAt_idx" ON "ProductViewLog"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductViewLog_userId_createdAt_idx" ON "ProductViewLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductViewLog_sessionId_createdAt_idx" ON "ProductViewLog"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductViewLog_createdAt_idx" ON "ProductViewLog"("createdAt");

-- CreateIndex
CREATE INDEX "ProductAddToCartLog_productId_createdAt_idx" ON "ProductAddToCartLog"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductAddToCartLog_variantId_createdAt_idx" ON "ProductAddToCartLog"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductAddToCartLog_shopId_createdAt_idx" ON "ProductAddToCartLog"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductAddToCartLog_userId_createdAt_idx" ON "ProductAddToCartLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductAddToCartLog_sessionId_createdAt_idx" ON "ProductAddToCartLog"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductAddToCartLog_createdAt_idx" ON "ProductAddToCartLog"("createdAt");

-- CreateIndex
CREATE INDEX "ModerationCase_entityType_entityId_status_idx" ON "ModerationCase"("entityType", "entityId", "status");

-- CreateIndex
CREATE INDEX "ModerationCase_status_severity_createdAt_idx" ON "ModerationCase"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationCase_entityType_entityId_idx" ON "ModerationCase"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ModerationCase_status_severity_updatedAt_idx" ON "ModerationCase"("status", "severity", "updatedAt");

-- CreateIndex
CREATE INDEX "ModerationCase_assignedToId_status_idx" ON "ModerationCase"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "ModerationCase_createdById_createdAt_idx" ON "ModerationCase"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationCase_reason_createdAt_idx" ON "ModerationCase"("reason", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAction_caseId_createdAt_idx" ON "ModerationAction"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAction_actorId_createdAt_idx" ON "ModerationAction"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAction_action_createdAt_idx" ON "ModerationAction"("action", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_status_receivedAt_idx" ON "WebhookEvent"("provider", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_eventType_status_receivedAt_idx" ON "WebhookEvent"("provider", "eventType", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_eventType_receivedAt_idx" ON "WebhookEvent"("provider", "eventType", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_receivedAt_idx" ON "WebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_processedById_processedAt_idx" ON "WebhookEvent"("processedById", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_externalId_key" ON "WebhookEvent"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_idempotencyKey_key" ON "WebhookEvent"("provider", "idempotencyKey");

-- CreateIndex
CREATE INDEX "IntegrationLog_provider_status_createdAt_idx" ON "IntegrationLog"("provider", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationLog_provider_operation_status_createdAt_idx" ON "IntegrationLog"("provider", "operation", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationLog_provider_operation_createdAt_idx" ON "IntegrationLog"("provider", "operation", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationLog_direction_status_createdAt_idx" ON "IntegrationLog"("direction", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationLog_relatedType_relatedId_idx" ON "IntegrationLog"("relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "IntegrationLog_requestId_idx" ON "IntegrationLog"("requestId");

-- CreateIndex
CREATE INDEX "IntegrationLog_createdAt_idx" ON "IntegrationLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "Category_parentId_isActive_sortOrder_idx" ON "Category"("parentId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ChatMessage_productId_idx" ON "ChatMessage"("productId");

-- CreateIndex
CREATE INDEX "ChatMessage_orderId_idx" ON "ChatMessage"("orderId");

-- CreateIndex
CREATE INDEX "ChatMessage_deletedAt_idx" ON "ChatMessage"("deletedAt");

-- CreateIndex
CREATE INDEX "ChatThread_buyerId_shopId_lastMessageAt_idx" ON "ChatThread"("buyerId", "shopId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatThread_buyerId_lastMessageAt_idx" ON "ChatThread"("buyerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatThread_shopId_lastMessageAt_idx" ON "ChatThread"("shopId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Coupon_shopId_isActive_startsAt_endsAt_idx" ON "Coupon"("shopId", "isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "FraudCase_reviewedById_idx" ON "FraudCase"("reviewedById");

-- CreateIndex
CREATE INDEX "FraudCase_resolvedById_idx" ON "FraudCase"("resolvedById");

-- CreateIndex
CREATE INDEX "InventoryReservation_checkoutId_inventoryId_idx" ON "InventoryReservation"("checkoutId", "inventoryId");

-- CreateIndex
CREATE INDEX "InventoryReservation_orderId_idx" ON "InventoryReservation"("orderId");

-- CreateIndex
CREATE INDEX "InventoryReservation_inventoryId_status_idx" ON "InventoryReservation"("inventoryId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_type_createdAt_idx" ON "Notification"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_userId_status_createdAt_idx" ON "Order"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Product_status_deletedAt_createdAt_idx" ON "Product"("status", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Product_shopId_status_deletedAt_createdAt_idx" ON "Product"("shopId", "status", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Product_categoryId_status_deletedAt_createdAt_idx" ON "Product"("categoryId", "status", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Product_brandId_status_deletedAt_createdAt_idx" ON "Product"("brandId", "status", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Product_shopId_slug_idx" ON "Product"("shopId", "slug");

-- CreateIndex
CREATE INDEX "Product_brandId_status_idx" ON "Product"("brandId", "status");

-- CreateIndex
CREATE INDEX "Product_categoryId_brandId_status_idx" ON "Product"("categoryId", "brandId", "status");

-- CreateIndex
CREATE INDEX "Product_sellerIdentityHash_productFingerprintHash_idx" ON "Product"("sellerIdentityHash", "productFingerprintHash");

-- CreateIndex
CREATE INDEX "Product_shopId_productFingerprintHash_idx" ON "Product"("shopId", "productFingerprintHash");

-- CreateIndex
CREATE INDEX "Product_productFingerprintHash_idx" ON "Product"("productFingerprintHash");

-- CreateIndex
CREATE INDEX "Product_duplicateStatus_idx" ON "Product"("duplicateStatus");

-- CreateIndex
CREATE INDEX "Product_duplicateOfProductId_idx" ON "Product"("duplicateOfProductId");

-- CreateIndex
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_sku_key" ON "ProductVariant"("productId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_optionCombinationKey_key" ON "ProductVariant"("productId", "optionCombinationKey");

-- CreateIndex
CREATE INDEX "Review_productId_status_createdAt_idx" ON "Review"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_userId_createdAt_idx" ON "Review"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SellerApplication_nationalIdHash_status_idx" ON "SellerApplication"("nationalIdHash", "status");

-- CreateIndex
CREATE INDEX "SellerApplication_shopContactEmail_idx" ON "SellerApplication"("shopContactEmail");

-- CreateIndex
CREATE INDEX "SellerApplication_shopContactPhone_idx" ON "SellerApplication"("shopContactPhone");

-- CreateIndex
CREATE INDEX "SellerPayout_requestedById_idx" ON "SellerPayout"("requestedById");

-- CreateIndex
CREATE INDEX "SellerPayout_approvedById_idx" ON "SellerPayout"("approvedById");

-- CreateIndex
CREATE INDEX "SellerPayout_rejectedById_idx" ON "SellerPayout"("rejectedById");

-- CreateIndex
CREATE INDEX "SellerPayout_paidById_idx" ON "SellerPayout"("paidById");

-- CreateIndex
CREATE INDEX "Session_deviceId_userId_revokedAt_idx" ON "Session"("deviceId", "userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Shipment_shopId_status_updatedAt_idx" ON "Shipment"("shopId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Shipment_providerId_status_updatedAt_idx" ON "Shipment"("providerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Shipment_providerId_status_idx" ON "Shipment"("providerId", "status");

-- CreateIndex
CREATE INDEX "Shop_slug_idx" ON "Shop"("slug");

-- CreateIndex
CREATE INDEX "Shop_ratingAverage_ratingCount_idx" ON "Shop"("ratingAverage", "ratingCount");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- RenameForeignKey
ALTER TABLE "ShopWallet" RENAME CONSTRAINT "SellerWallet_shopId_fkey" TO "ShopWallet_shopId_fkey";

-- AddForeignKey
ALTER TABLE "DeviceAccount" ADD CONSTRAINT "DeviceAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerProfile" ADD CONSTRAINT "SellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerApplication" ADD CONSTRAINT "SellerApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerApplication" ADD CONSTRAINT "SellerApplication_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerApplication" ADD CONSTRAINT "SellerApplication_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerApplication" ADD CONSTRAINT "SellerApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerKycDocument" ADD CONSTRAINT "SellerKycDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SellerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerKycDocument" ADD CONSTRAINT "SellerKycDocument_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAttributeDefinition" ADD CONSTRAINT "CategoryAttributeDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_duplicateOfProductId_fkey" FOREIGN KEY ("duplicateOfProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOptionValue" ADD CONSTRAINT "ProductOptionValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_optionValueId_fkey" FOREIGN KEY ("optionValueId") REFERENCES "ProductOptionValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductHighlight" ADD CONSTRAINT "ProductHighlight_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVideo" ADD CONSTRAINT "ProductVideo_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVideo" ADD CONSTRAINT "ProductVideo_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopStaff" ADD CONSTRAINT "ShopStaff_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopStaff" ADD CONSTRAINT "ShopStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopStaff" ADD CONSTRAINT "ShopStaff_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopStaffPermission" ADD CONSTRAINT "ShopStaffPermission_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "ShopStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopRating" ADD CONSTRAINT "ShopRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopRating" ADD CONSTRAINT "ShopRating_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopRating" ADD CONSTRAINT "ShopRating_shopOrderId_shopId_fkey" FOREIGN KEY ("shopOrderId", "shopId") REFERENCES "ShopOrder"("id", "shopId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopRating" ADD CONSTRAINT "ShopRating_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopSetting" ADD CONSTRAINT "ShopSetting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopAddress" ADD CONSTRAINT "ShopAddress_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopDailyStats" ADD CONSTRAINT "ShopDailyStats_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopActivityLog" ADD CONSTRAINT "ShopActivityLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopActivityLog" ADD CONSTRAINT "ShopActivityLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDuplicateReview" ADD CONSTRAINT "ProductDuplicateReview_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDuplicateReview" ADD CONSTRAINT "ProductDuplicateReview_candidateProductId_fkey" FOREIGN KEY ("candidateProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDuplicateReview" ADD CONSTRAINT "ProductDuplicateReview_reportedByShopId_fkey" FOREIGN KEY ("reportedByShopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDuplicateReview" ADD CONSTRAINT "ProductDuplicateReview_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDuplicateReview" ADD CONSTRAINT "ProductDuplicateReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShippingProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_shopRatingId_fkey" FOREIGN KEY ("shopRatingId") REFERENCES "ShopRating"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_shopRatingId_fkey" FOREIGN KEY ("shopRatingId") REFERENCES "ShopRating"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_walletId_shopId_fkey" FOREIGN KEY ("walletId", "shopId") REFERENCES "ShopWallet"("id", "shopId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_walletId_shopId_fkey" FOREIGN KEY ("walletId", "shopId") REFERENCES "ShopWallet"("id", "shopId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerTransaction" ADD CONSTRAINT "SellerTransaction_walletId_shopId_fkey" FOREIGN KEY ("walletId", "shopId") REFERENCES "ShopWallet"("id", "shopId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerTransaction" ADD CONSTRAINT "SellerTransaction_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerTransaction" ADD CONSTRAINT "SellerTransaction_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerTransaction" ADD CONSTRAINT "SellerTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerTransaction" ADD CONSTRAINT "SellerTransaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "SellerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerTransaction" ADD CONSTRAINT "SellerTransaction_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerViolation" ADD CONSTRAINT "SellerViolation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerViolation" ADD CONSTRAINT "SellerViolation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopRestriction" ADD CONSTRAINT "ShopRestriction_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopRestriction" ADD CONSTRAINT "ShopRestriction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThreadReadState" ADD CONSTRAINT "ChatThreadReadState_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThreadReadState" ADD CONSTRAINT "ChatThreadReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudCase" ADD CONSTRAINT "FraudCase_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudCase" ADD CONSTRAINT "FraudCase_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProvider" ADD CONSTRAINT "ShippingProvider_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAnswer" ADD CONSTRAINT "ProductAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ProductQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAnswer" ADD CONSTRAINT "ProductAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExportJob" ADD CONSTRAINT "ReportExportJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchQueryLog" ADD CONSTRAINT "SearchQueryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductViewLog" ADD CONSTRAINT "ProductViewLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductViewLog" ADD CONSTRAINT "ProductViewLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductViewLog" ADD CONSTRAINT "ProductViewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAddToCartLog" ADD CONSTRAINT "ProductAddToCartLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAddToCartLog" ADD CONSTRAINT "ProductAddToCartLog_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAddToCartLog" ADD CONSTRAINT "ProductAddToCartLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAddToCartLog" ADD CONSTRAINT "ProductAddToCartLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "SellerWallet_shopId_key" RENAME TO "ShopWallet_shopId_key";
