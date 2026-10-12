-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UploadUsage" ADD VALUE 'SUPPORT_ATTACHMENT';
ALTER TYPE "UploadUsage" ADD VALUE 'FINANCE_EVIDENCE';
ALTER TYPE "UploadUsage" ADD VALUE 'CATALOG_IMPORT';

-- AlterTable
ALTER TABLE "SellerPayout" ADD COLUMN     "cycleKey" TEXT,
ADD COLUMN     "evidenceUploadId" UUID;

-- AlterTable
ALTER TABLE "ReportExportJob" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "result" JSONB,
ADD COLUMN     "runKey" TEXT,
ADD COLUMN     "scheduleId" UUID;

-- CreateTable
CREATE TABLE "AdminTeamMember" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAccessRule" (
    "id" UUID NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectValue" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "actions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAccessRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOperationPolicy" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "commissionBps" INTEGER,
    "dispatchSlaHours" INTEGER NOT NULL DEFAULT 72,
    "deliverySlaHours" INTEGER NOT NULL DEFAULT 168,
    "shippingRatesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutCadence" TEXT NOT NULL DEFAULT 'MANUAL',
    "payoutMinimum" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopOperationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingRateRule" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "shopId" UUID,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'TH',
    "postalPrefixes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minWeightGrams" INTEGER NOT NULL DEFAULT 0,
    "maxWeightGrams" INTEGER,
    "maxLengthMm" INTEGER,
    "maxWidthMm" INTEGER,
    "maxHeightMm" INTEGER,
    "volumetricDivisor" INTEGER NOT NULL DEFAULT 5000,
    "baseFee" BIGINT NOT NULL DEFAULT 0,
    "perKgFee" BIGINT NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRateRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReconciliation" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "batchKey" TEXT,
    "paymentId" UUID,
    "payoutId" UUID,
    "refundId" UUID,
    "sourceKey" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "externalReference" TEXT,
    "occurredAt" TIMESTAMP(3),
    "uploadId" UUID,
    "status" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "note" TEXT,
    "createdById" UUID NOT NULL,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" "ReportExportFormat" NOT NULL DEFAULT 'XLSX',
    "filters" JSONB NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'DAILY',
    "hour" INTEGER NOT NULL DEFAULT 8,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requestedById" UUID NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPage" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "draftBody" TEXT NOT NULL,
    "publishedBody" TEXT,
    "publishedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogImportJob" (
    "id" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "requestKey" TEXT NOT NULL,
    "shopId" UUID,
    "mode" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "previewFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "result" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDocument" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminTeamMember_userId_key" ON "AdminTeamMember"("userId");

-- CreateIndex
CREATE INDEX "AdminTeamMember_isActive_isOwner_idx" ON "AdminTeamMember"("isActive", "isOwner");

-- CreateIndex
CREATE INDEX "AdminAccessRule_subjectType_subjectValue_isActive_idx" ON "AdminAccessRule"("subjectType", "subjectValue", "isActive");

-- CreateIndex
CREATE INDEX "AdminAccessRule_isActive_expiresAt_idx" ON "AdminAccessRule"("isActive", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOperationPolicy_shopId_key" ON "ShopOperationPolicy"("shopId");

-- CreateIndex
CREATE INDEX "ShippingRateRule_shopId_isActive_priority_idx" ON "ShippingRateRule"("shopId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "ShippingRateRule_providerId_isActive_idx" ON "ShippingRateRule"("providerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReconciliation_sourceKey_key" ON "FinanceReconciliation"("sourceKey");

-- CreateIndex
CREATE INDEX "FinanceReconciliation_kind_status_createdAt_idx" ON "FinanceReconciliation"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceReconciliation_paymentId_idx" ON "FinanceReconciliation"("paymentId");

-- CreateIndex
CREATE INDEX "FinanceReconciliation_payoutId_idx" ON "FinanceReconciliation"("payoutId");

-- CreateIndex
CREATE INDEX "FinanceReconciliation_batchKey_idx" ON "FinanceReconciliation"("batchKey");

-- CreateIndex
CREATE INDEX "ReportSchedule_isActive_nextRunAt_idx" ON "ReportSchedule"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "ContentPage_publishedAt_idx" ON "ContentPage"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_slug_locale_key" ON "ContentPage"("slug", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogImportJob_requestKey_key" ON "CatalogImportJob"("requestKey");

-- CreateIndex
CREATE INDEX "CatalogImportJob_requestedById_createdAt_idx" ON "CatalogImportJob"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "CatalogImportJob_status_expiresAt_idx" ON "CatalogImportJob"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDocument_number_key" ON "OrderDocument"("number");

-- CreateIndex
CREATE INDEX "OrderDocument_issuedAt_idx" ON "OrderDocument"("issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDocument_orderId_kind_locale_key" ON "OrderDocument"("orderId", "kind", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "SellerPayout_shopId_cycleKey_key" ON "SellerPayout"("shopId", "cycleKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReportExportJob_runKey_key" ON "ReportExportJob"("runKey");

-- AddForeignKey
ALTER TABLE "ReportExportJob" ADD CONSTRAINT "ReportExportJob_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ReportSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTeamMember" ADD CONSTRAINT "AdminTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOperationPolicy" ADD CONSTRAINT "ShopOperationPolicy_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingRateRule" ADD CONSTRAINT "ShippingRateRule_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShippingProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingRateRule" ADD CONSTRAINT "ShippingRateRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDocument" ADD CONSTRAINT "OrderDocument_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "AdminTeamMember" ("id", "userId", "label", "permissions", "isOwner", "isActive", "version", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'Owner', ARRAY[]::TEXT[], true, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" WHERE "role" = 'ADMIN';

CREATE UNIQUE INDEX "FeatureToggle_global_key" ON "FeatureToggle"("key") WHERE "scope" = 'GLOBAL' AND "scopeId" IS NULL;
CREATE UNIQUE INDEX "ShippingProvider_global_code" ON "ShippingProvider"("code") WHERE "shopId" IS NULL;
ALTER TABLE "FeatureToggle" ADD CONSTRAINT "FeatureToggle_scope_identity" CHECK (("scope" = 'GLOBAL' AND "scopeId" IS NULL) OR ("scope" <> 'GLOBAL' AND "scopeId" IS NOT NULL));
ALTER TABLE "ShopOperationPolicy" ADD CONSTRAINT "ShopOperationPolicy_bounds" CHECK (("commissionBps" IS NULL OR "commissionBps" BETWEEN 0 AND 10000) AND "dispatchSlaHours" > 0 AND "deliverySlaHours" > 0 AND "payoutMinimum" >= 0);
ALTER TABLE "ShippingRateRule" ADD CONSTRAINT "ShippingRateRule_bounds" CHECK ("minWeightGrams" >= 0 AND ("maxWeightGrams" IS NULL OR "maxWeightGrams" >= "minWeightGrams") AND "baseFee" >= 0 AND "perKgFee" >= 0 AND "volumetricDivisor" > 0);
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_hour_bounds" CHECK ("hour" BETWEEN 0 AND 23);
ALTER TABLE "FinanceReconciliation" ADD CONSTRAINT "FinanceReconciliation_amount_bounds" CHECK ("amount" >= 0);
