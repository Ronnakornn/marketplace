-- Reconcile promotion tables that predate the checked-in migration history.
DO $$ BEGIN CREATE TYPE "CoinLedgerEntryType" AS ENUM ('EARNED', 'SPENT', 'REFUNDED', 'EXPIRED', 'ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CoinLedgerStatus" AS ENUM ('PENDING', 'AVAILABLE', 'USED', 'EXPIRED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FlashSaleStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BuyerCoinWallet" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "balance" BIGINT NOT NULL DEFAULT 0,
  "pendingBalance" BIGINT NOT NULL DEFAULT 0, "debtBalance" BIGINT NOT NULL DEFAULT 0, "lifetimeEarned" BIGINT NOT NULL DEFAULT 0,
  "lifetimeSpent" BIGINT NOT NULL DEFAULT 0, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BuyerCoinWallet_pkey" PRIMARY KEY ("id"), CONSTRAINT "BuyerCoinWallet_userId_key" UNIQUE ("userId"),
  CONSTRAINT "BuyerCoinWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "BuyerCoinWallet" ADD COLUMN IF NOT EXISTS "debtBalance" BIGINT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS "BuyerCoinLedger" (
  "id" UUID NOT NULL, "walletId" UUID NOT NULL, "userId" UUID NOT NULL, "orderId" UUID,
  "type" "CoinLedgerEntryType" NOT NULL, "status" "CoinLedgerStatus" NOT NULL DEFAULT 'AVAILABLE',
  "amount" BIGINT NOT NULL, "balanceAfter" BIGINT, "reason" TEXT, "referenceType" TEXT,
  "referenceId" UUID, "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BuyerCoinLedger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BuyerCoinLedger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "BuyerCoinWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BuyerCoinLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BuyerCoinLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "BuyerCoinLedger_walletId_createdAt_idx" ON "BuyerCoinLedger"("walletId", "createdAt");
CREATE INDEX IF NOT EXISTS "BuyerCoinLedger_userId_status_expiresAt_idx" ON "BuyerCoinLedger"("userId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "BuyerCoinLedger_orderId_idx" ON "BuyerCoinLedger"("orderId");
CREATE INDEX IF NOT EXISTS "BuyerCoinLedger_referenceType_referenceId_idx" ON "BuyerCoinLedger"("referenceType", "referenceId");

CREATE TABLE IF NOT EXISTS "FlashSale" (
  "id" UUID NOT NULL, "shopId" UUID, "title" TEXT NOT NULL, "description" TEXT,
  "status" "FlashSaleStatus" NOT NULL DEFAULT 'DRAFT', "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlashSale_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FlashSale_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FlashSale_shopId_status_startsAt_endsAt_idx" ON "FlashSale"("shopId", "status", "startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "FlashSale_status_startsAt_endsAt_idx" ON "FlashSale"("status", "startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "FlashSale_shopId_status_idx" ON "FlashSale"("shopId", "status");
CREATE TABLE IF NOT EXISTS "FlashSaleItem" (
  "id" UUID NOT NULL, "flashSaleId" UUID NOT NULL, "shopId" UUID NOT NULL, "productId" UUID NOT NULL,
  "variantId" UUID NOT NULL, "salePrice" BIGINT NOT NULL, "originalPrice" BIGINT NOT NULL,
  "stockLimit" INTEGER NOT NULL, "soldCount" INTEGER NOT NULL DEFAULT 0, "perUserLimit" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlashSaleItem_pkey" PRIMARY KEY ("id"), CONSTRAINT "FlashSaleItem_flashSaleId_variantId_key" UNIQUE ("flashSaleId", "variantId"),
  CONSTRAINT "FlashSaleItem_flashSaleId_fkey" FOREIGN KEY ("flashSaleId") REFERENCES "FlashSale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FlashSaleItem_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FlashSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FlashSaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FlashSaleItem_flashSaleId_isActive_idx" ON "FlashSaleItem"("flashSaleId", "isActive");
CREATE INDEX IF NOT EXISTS "FlashSaleItem_flashSaleId_shopId_isActive_idx" ON "FlashSaleItem"("flashSaleId", "shopId", "isActive");
CREATE INDEX IF NOT EXISTS "FlashSaleItem_shopId_isActive_idx" ON "FlashSaleItem"("shopId", "isActive");
CREATE INDEX IF NOT EXISTS "FlashSaleItem_productId_idx" ON "FlashSaleItem"("productId");
CREATE INDEX IF NOT EXISTS "FlashSaleItem_variantId_idx" ON "FlashSaleItem"("variantId");

CREATE TABLE IF NOT EXISTS "FlashSaleReservation" (
    "id" UUID NOT NULL,
    "checkoutId" UUID NOT NULL,
    "flashSaleItemId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FlashSaleReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FlashSaleReservation_checkoutId_flashSaleItemId_key"
  ON "FlashSaleReservation"("checkoutId", "flashSaleItemId");
CREATE INDEX IF NOT EXISTS "FlashSaleReservation_flashSaleItemId_status_idx"
  ON "FlashSaleReservation"("flashSaleItemId", "status");
CREATE INDEX IF NOT EXISTS "FlashSaleReservation_userId_flashSaleItemId_status_idx"
  ON "FlashSaleReservation"("userId", "flashSaleItemId", "status");
CREATE INDEX IF NOT EXISTS "FlashSaleReservation_status_expiresAt_idx"
  ON "FlashSaleReservation"("status", "expiresAt");

DO $$ BEGIN
  ALTER TABLE "FlashSaleReservation" ADD CONSTRAINT "FlashSaleReservation_checkoutId_fkey"
    FOREIGN KEY ("checkoutId") REFERENCES "Checkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FlashSaleReservation" ADD CONSTRAINT "FlashSaleReservation_flashSaleItemId_fkey"
    FOREIGN KEY ("flashSaleItemId") REFERENCES "FlashSaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FlashSaleReservation" ADD CONSTRAINT "FlashSaleReservation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
