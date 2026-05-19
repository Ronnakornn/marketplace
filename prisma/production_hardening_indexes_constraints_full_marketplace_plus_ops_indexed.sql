-- PostgreSQL safe/no-global-transaction version
-- Fixes:
-- 1) Removes global BEGIN/COMMIT so one failed statement will not abort the entire file.
-- 2) Replaces ProductVariant.price with ProductVariant.price to match the current Prisma schema.
-- 3) Before running this file after a failed attempt, run: ROLLBACK;

-- PostgreSQL fixed/idempotent version
-- This file removes unsupported `ADD CONSTRAINT IF NOT EXISTS` syntax.
-- It also drops existing constraints before re-adding them, so it can be re-run after a partial failed attempt.

-- Production hardening migration for schema_seller_final_production_10_10.prisma
-- PostgreSQL / Prisma raw SQL migration

-- 1) Soft-delete friendly unique constraints for Shop.
-- Drop Prisma-generated unique indexes if they exist from the old schema.
DROP INDEX IF EXISTS "Shop_slug_key";
DROP INDEX IF EXISTS "Shop_contactEmail_key";
DROP INDEX IF EXISTS "Shop_contactPhone_key";
DROP INDEX IF EXISTS "Product_shopId_slug_key";
DROP INDEX IF EXISTS "Product_shopId_productFingerprintHash_key";

CREATE UNIQUE INDEX IF NOT EXISTS shops_slug_active_unique
  ON "Shop" ("slug")
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shops_contact_email_active_unique
  ON "Shop" ("contactEmail")
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shops_contact_phone_active_unique
  ON "Shop" ("contactPhone")
  WHERE "deletedAt" IS NULL;

-- 2) Product uniqueness with soft delete.
-- Product slug should be unique only among active non-deleted records inside the same shop.
CREATE UNIQUE INDEX IF NOT EXISTS products_shop_slug_active_unique
  ON "Product" ("shopId", "slug")
  WHERE "deletedAt" IS NULL;

-- Block the same seller from listing the same fingerprint across multiple shops.
-- APPROVED_EXCEPTION allows admin-approved special cases without dropping the index.
CREATE UNIQUE INDEX IF NOT EXISTS products_seller_fingerprint_active_unique
  ON "Product" ("sellerProfileId", "productFingerprintHash")
  WHERE "deletedAt" IS NULL
    AND "sellerProfileId" IS NOT NULL
    AND "productFingerprintHash" IS NOT NULL
    AND "status" <> 'ARCHIVED'
    AND "duplicateStatus" <> 'APPROVED_EXCEPTION';

-- 3) Only one ACTIVE cart per user.
CREATE UNIQUE INDEX IF NOT EXISTS carts_one_active_per_user_unique
  ON "Cart" ("userId")
  WHERE "status" = 'ACTIVE';

-- 4) Keep Product.sellerProfileId and Product.sellerIdentityHash in sync with Shop.
CREATE OR REPLACE FUNCTION sync_product_seller_identity()
RETURNS trigger AS $$
DECLARE
  shop_row RECORD;
BEGIN
  SELECT "sellerProfileId", "sellerIdentityHash"
    INTO shop_row
  FROM "Shop"
  WHERE "id" = NEW."shopId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop % does not exist', NEW."shopId";
  END IF;

  NEW."sellerProfileId" := shop_row."sellerProfileId";
  NEW."sellerIdentityHash" := shop_row."sellerIdentityHash";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_seller_identity ON "Product";
CREATE TRIGGER trg_sync_product_seller_identity
BEFORE INSERT OR UPDATE OF "shopId" ON "Product"
FOR EACH ROW
EXECUTE FUNCTION sync_product_seller_identity();

-- 5) Enforce max shops per seller profile and national identity hash.
-- Counts non-deleted shops that are not rejected/banned.
CREATE OR REPLACE FUNCTION enforce_seller_shop_limit()
RETURNS trigger AS $$
DECLARE
  max_count INTEGER;
  profile_count INTEGER;
  identity_count INTEGER;
BEGIN
  IF NEW."deletedAt" IS NOT NULL OR NEW."status" IN ('REJECTED', 'BANNED') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE("maxShopCount", 5)
    INTO max_count
  FROM "SellerProfile"
  WHERE "id" = NEW."sellerProfileId";

  IF max_count IS NULL THEN
    max_count := 5;
  END IF;

  SELECT COUNT(*)
    INTO profile_count
  FROM "Shop"
  WHERE "sellerProfileId" = NEW."sellerProfileId"
    AND "deletedAt" IS NULL
    AND "status" NOT IN ('REJECTED', 'BANNED')
    AND "id" <> NEW."id";

  IF profile_count >= max_count THEN
    RAISE EXCEPTION 'Seller profile % cannot open more than % shops', NEW."sellerProfileId", max_count;
  END IF;

  IF NEW."sellerIdentityHash" IS NOT NULL THEN
    SELECT COUNT(*)
      INTO identity_count
    FROM "Shop"
    WHERE "sellerIdentityHash" = NEW."sellerIdentityHash"
      AND "deletedAt" IS NULL
      AND "status" NOT IN ('REJECTED', 'BANNED')
      AND "id" <> NEW."id";

    IF identity_count >= max_count THEN
      RAISE EXCEPTION 'Seller identity cannot open more than % shops', max_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_seller_shop_limit ON "Shop";
CREATE TRIGGER trg_enforce_seller_shop_limit
BEFORE INSERT OR UPDATE OF "sellerProfileId", "sellerIdentityHash", "status", "deletedAt" ON "Shop"
FOR EACH ROW
EXECUTE FUNCTION enforce_seller_shop_limit();

-- 6) Business value checks.
ALTER TABLE "SellerProfile" DROP CONSTRAINT IF EXISTS seller_profiles_max_shop_count_check;
ALTER TABLE "SellerProfile"
  ADD CONSTRAINT seller_profiles_max_shop_count_check
  CHECK ("maxShopCount" BETWEEN 1 AND 5) NOT VALID;

ALTER TABLE "Shop" DROP CONSTRAINT IF EXISTS shops_rating_average_check;
ALTER TABLE "Shop" DROP CONSTRAINT IF EXISTS shops_rating_count_check;
ALTER TABLE "Shop" DROP CONSTRAINT IF EXISTS shops_follower_count_check;
ALTER TABLE "Shop" DROP CONSTRAINT IF EXISTS shops_product_count_check;
ALTER TABLE "Shop"
  ADD CONSTRAINT shops_rating_average_check
  CHECK ("ratingAverage" >= 0 AND "ratingAverage" <= 5) NOT VALID,
  ADD CONSTRAINT shops_rating_count_check
  CHECK ("ratingCount" >= 0) NOT VALID,
  ADD CONSTRAINT shops_follower_count_check
  CHECK ("followerCount" >= 0) NOT VALID,
  ADD CONSTRAINT shops_product_count_check
  CHECK ("productCount" >= 0) NOT VALID;

ALTER TABLE "ShopRating" DROP CONSTRAINT IF EXISTS shop_ratings_rating_check;
ALTER TABLE "ShopRating"
  ADD CONSTRAINT shop_ratings_rating_check
  CHECK ("rating" BETWEEN 1 AND 5) NOT VALID;

ALTER TABLE "ProductVariant" DROP CONSTRAINT IF EXISTS product_variants_price_check;
ALTER TABLE "ProductVariant"
  ADD CONSTRAINT product_variants_price_check
  CHECK ("price" >= 0) NOT VALID;

ALTER TABLE "Inventory" DROP CONSTRAINT IF EXISTS inventory_quantities_check;
ALTER TABLE "Inventory"
  ADD CONSTRAINT inventory_quantities_check
  CHECK ("quantityOnHand" >= 0 AND "quantityReserved" >= 0 AND "reorderLevel" >= 0 AND "quantityReserved" <= "quantityOnHand") NOT VALID;

ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS cart_items_quantity_price_check;
ALTER TABLE "CartItem"
  ADD CONSTRAINT cart_items_quantity_price_check
  CHECK ("quantity" > 0 AND "unitPrice" >= 0) NOT VALID;

ALTER TABLE "Checkout" DROP CONSTRAINT IF EXISTS checkouts_money_check;
ALTER TABLE "Checkout"
  ADD CONSTRAINT checkouts_money_check
  CHECK ("subtotal" >= 0 AND "discountTotal" >= 0 AND "shippingTotal" >= 0 AND "taxTotal" >= 0 AND "grandTotal" >= 0) NOT VALID;

ALTER TABLE "InventoryReservation" DROP CONSTRAINT IF EXISTS inventory_reservations_quantity_check;
ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT inventory_reservations_quantity_check
  CHECK ("quantity" > 0) NOT VALID;

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS orders_money_check;
ALTER TABLE "Order"
  ADD CONSTRAINT orders_money_check
  CHECK ("subtotal" >= 0 AND "discountTotal" >= 0 AND "shippingTotal" >= 0 AND "taxTotal" >= 0 AND "grandTotal" >= 0) NOT VALID;

ALTER TABLE "ShopOrder" DROP CONSTRAINT IF EXISTS shop_orders_money_check;
ALTER TABLE "ShopOrder"
  ADD CONSTRAINT shop_orders_money_check
  CHECK ("subtotal" >= 0 AND "discountTotal" >= 0 AND "shippingTotal" >= 0 AND "taxTotal" >= 0 AND "grandTotal" >= 0) NOT VALID;

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS order_items_quantity_money_check;
ALTER TABLE "OrderItem"
  ADD CONSTRAINT order_items_quantity_money_check
  CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "lineTotal" >= 0) NOT VALID;

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE "Payment"
  ADD CONSTRAINT payments_amount_check
  CHECK ("amount" >= 0) NOT VALID;

ALTER TABLE "ShipmentItem" DROP CONSTRAINT IF EXISTS shipment_items_quantity_check;
ALTER TABLE "ShipmentItem"
  ADD CONSTRAINT shipment_items_quantity_check
  CHECK ("quantity" > 0) NOT VALID;

ALTER TABLE "Coupon" DROP CONSTRAINT IF EXISTS coupons_discount_check;
ALTER TABLE "Coupon"
  ADD CONSTRAINT coupons_discount_check
  CHECK (
    ("discountValue" IS NULL OR "discountValue" >= 0)
    AND ("discountPercentBps" IS NULL OR "discountPercentBps" BETWEEN 0 AND 10000)
    AND ("minOrder" IS NULL OR "minOrder" >= 0)
    AND ("maxDiscount" IS NULL OR "maxDiscount" >= 0)
    AND ("usageLimit" IS NULL OR "usageLimit" > 0)
    AND ("perUserLimit" IS NULL OR "perUserLimit" > 0)
  ) NOT VALID;

ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS reviews_rating_check;
ALTER TABLE "Review"
  ADD CONSTRAINT reviews_rating_check
  CHECK ("rating" BETWEEN 1 AND 5) NOT VALID;

ALTER TABLE "Refund" DROP CONSTRAINT IF EXISTS refunds_amount_check;
ALTER TABLE "Refund"
  ADD CONSTRAINT refunds_amount_check
  CHECK ("amount" >= 0) NOT VALID;

ALTER TABLE "ShopWallet" DROP CONSTRAINT IF EXISTS shop_wallets_balances_check;
ALTER TABLE "ShopWallet"
  ADD CONSTRAINT shop_wallets_balances_check
  CHECK ("balance" >= 0 AND "pendingBalance" >= 0 AND "withdrawableBalance" >= 0) NOT VALID;

ALTER TABLE "WalletLedgerEntry" DROP CONSTRAINT IF EXISTS wallet_ledger_entries_amount_check;
ALTER TABLE "WalletLedgerEntry"
  ADD CONSTRAINT wallet_ledger_entries_amount_check
  CHECK (
    ("type" = 'payout_paid' AND "amount" = 0)
    OR ("type" <> 'payout_paid' AND "amount" <> 0)
  ) NOT VALID;

ALTER TABLE "SellerPayout" DROP CONSTRAINT IF EXISTS seller_payouts_amount_check;
ALTER TABLE "SellerPayout"
  ADD CONSTRAINT seller_payouts_amount_check
  CHECK ("amount" > 0) NOT VALID;

ALTER TABLE "SellerTransaction" DROP CONSTRAINT IF EXISTS seller_transactions_amount_check;
ALTER TABLE "SellerTransaction"
  ADD CONSTRAINT seller_transactions_amount_check
  CHECK ("amount" <> 0) NOT VALID;

ALTER TABLE "ReturnItem" DROP CONSTRAINT IF EXISTS return_items_quantity_check;
ALTER TABLE "ReturnItem"
  ADD CONSTRAINT return_items_quantity_check
  CHECK ("quantity" > 0) NOT VALID;

ALTER TABLE "Upload" DROP CONSTRAINT IF EXISTS uploads_file_size_check;
ALTER TABLE "Upload"
  ADD CONSTRAINT uploads_file_size_check
  CHECK ("fileSize" > 0) NOT VALID;

ALTER TABLE "FraudCase" DROP CONSTRAINT IF EXISTS fraud_cases_risk_score_check;
ALTER TABLE "FraudCase"
  ADD CONSTRAINT fraud_cases_risk_score_check
  CHECK ("riskScore" BETWEEN 0 AND 100) NOT VALID;

ALTER TABLE "OutboxEvent" DROP CONSTRAINT IF EXISTS outbox_events_retry_count_check;
ALTER TABLE "OutboxEvent"
  ADD CONSTRAINT outbox_events_retry_count_check
  CHECK ("retryCount" >= 0) NOT VALID;

ALTER TABLE "AffiliateCommission" DROP CONSTRAINT IF EXISTS affiliate_commissions_values_check;
ALTER TABLE "AffiliateCommission"
  ADD CONSTRAINT affiliate_commissions_values_check
  CHECK (
    "eligiblesubtotal" >= 0
    AND "commissionBps" BETWEEN 0 AND 10000
    AND "commission" >= 0
  ) NOT VALID;


-- Additional production essentials: policy strikes, restrictions, internal notes, return scoping.
-- Add shop scoping to ReturnRequest for multi-shop orders.
ALTER TABLE "ReturnRequest"
  ADD COLUMN IF NOT EXISTS "shopId" uuid;

-- Backfill shopId for existing return requests only when all returned items belong to one shop.
-- Review manually before setting NOT NULL if old data has mixed-shop return requests.
UPDATE "ReturnRequest" rr
SET "shopId" = src."shopId"
FROM (
  SELECT
    ri."returnRequestId",
    (ARRAY_AGG(DISTINCT oi."shopId"))[1] AS "shopId",
    COUNT(DISTINCT oi."shopId") AS shop_count
  FROM "ReturnItem" ri
  JOIN "OrderItem" oi
    ON oi."id" = ri."orderItemId"
  GROUP BY ri."returnRequestId"
) src
WHERE rr."id" = src."returnRequestId"
  AND src.shop_count = 1
  AND rr."shopId" IS NULL;

CREATE INDEX IF NOT EXISTS return_requests_shop_status_created_at_idx
  ON "ReturnRequest" ("shopId", "status", "createdAt");

ALTER TABLE "ReturnRequest" DROP CONSTRAINT IF EXISTS return_requests_shop_fk;
ALTER TABLE "ReturnRequest"
  ADD CONSTRAINT return_requests_shop_fk
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE NOT VALID;

-- Enable this after backfill is complete in production:
-- ALTER TABLE "ReturnRequest" ALTER COLUMN "shopId" SET NOT NULL;
-- ALTER TABLE "ReturnRequest" VALIDATE CONSTRAINT return_requests_shop_fk;

-- ShopRestriction active-window safety.
ALTER TABLE "ShopRestriction" DROP CONSTRAINT IF EXISTS shop_restrictions_time_window_check;
ALTER TABLE "ShopRestriction"
  ADD CONSTRAINT shop_restrictions_time_window_check
  CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt") NOT VALID;

-- Prevent duplicate active restrictions of the same type per shop.
CREATE UNIQUE INDEX IF NOT EXISTS shop_restrictions_one_active_type_unique
  ON "ShopRestriction" ("shopId", "type")
  WHERE "revokedAt" IS NULL;

-- SellerViolation quality checks.
ALTER TABLE "SellerViolation" DROP CONSTRAINT IF EXISTS seller_violations_reason_not_blank_check;
ALTER TABLE "SellerViolation"
  ADD CONSTRAINT seller_violations_reason_not_blank_check
  CHECK (length(trim("reason")) > 0) NOT VALID;

-- InternalNote quality checks.
ALTER TABLE "InternalNote" DROP CONSTRAINT IF EXISTS internal_notes_entity_type_not_blank_check;
ALTER TABLE "InternalNote" DROP CONSTRAINT IF EXISTS internal_notes_note_not_blank_check;
ALTER TABLE "InternalNote"
  ADD CONSTRAINT internal_notes_entity_type_not_blank_check
  CHECK (length(trim("entityType")) > 0) NOT VALID,
  ADD CONSTRAINT internal_notes_note_not_blank_check
  CHECK (length(trim("note")) > 0) NOT VALID;

-- COMMIT removed: run statement-by-statement to avoid aborted transaction state.

-- Review Module hardening
ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS review_rating_between_1_and_5;
ALTER TABLE "Review"
  ADD CONSTRAINT review_rating_between_1_and_5 CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "ShopRating" DROP CONSTRAINT IF EXISTS shop_rating_between_1_and_5;
ALTER TABLE "ShopRating"
  ADD CONSTRAINT shop_rating_between_1_and_5 CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "ReviewMedia" DROP CONSTRAINT IF EXISTS review_media_exactly_one_target;
ALTER TABLE "ReviewMedia"
  ADD CONSTRAINT review_media_exactly_one_target CHECK (
    (("reviewId" IS NOT NULL)::int + ("shopRatingId" IS NOT NULL)::int) = 1
  );

ALTER TABLE "ReviewReport" DROP CONSTRAINT IF EXISTS review_report_exactly_one_target;
ALTER TABLE "ReviewReport"
  ADD CONSTRAINT review_report_exactly_one_target CHECK (
    (("reviewId" IS NOT NULL)::int + ("shopRatingId" IS NOT NULL)::int) = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS review_reports_one_open_report_per_user_product_review
ON "ReviewReport" ("reviewId", "reportedById")
WHERE "reviewId" IS NOT NULL AND "status" IN ('OPEN', 'UNDER_REVIEW');

CREATE UNIQUE INDEX IF NOT EXISTS review_reports_one_open_report_per_user_shop_rating
ON "ReviewReport" ("shopRatingId", "reportedById")
WHERE "shopRatingId" IS NOT NULL AND "status" IN ('OPEN', 'UNDER_REVIEW');

CREATE INDEX IF NOT EXISTS review_media_review_images_idx
ON "ReviewMedia" ("reviewId", "sortOrder")
WHERE "reviewId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS review_media_shop_rating_images_idx
ON "ReviewMedia" ("shopRatingId", "sortOrder")
WHERE "shopRatingId" IS NOT NULL;

-- Full marketplace module hardening: shipping providers, coins, flash sales, marketing, support, Q&A, settings, exports

ALTER TABLE "BuyerCoinWallet" DROP CONSTRAINT IF EXISTS buyer_coin_wallet_balance_non_negative;
ALTER TABLE "BuyerCoinWallet" DROP CONSTRAINT IF EXISTS buyer_coin_wallet_pending_non_negative;
ALTER TABLE "BuyerCoinWallet" DROP CONSTRAINT IF EXISTS buyer_coin_wallet_lifetime_non_negative;
ALTER TABLE "BuyerCoinWallet"
  ADD CONSTRAINT buyer_coin_wallet_balance_non_negative CHECK ("balance" >= 0),
  ADD CONSTRAINT buyer_coin_wallet_pending_non_negative CHECK ("pendingBalance" >= 0),
  ADD CONSTRAINT buyer_coin_wallet_lifetime_non_negative CHECK ("lifetimeEarned" >= 0 AND "lifetimeSpent" >= 0);

ALTER TABLE "BuyerCoinLedger" DROP CONSTRAINT IF EXISTS buyer_coin_ledger_amount_non_zero;
ALTER TABLE "BuyerCoinLedger"
  ADD CONSTRAINT buyer_coin_ledger_amount_non_zero CHECK ("amount" <> 0);

ALTER TABLE "FlashSale" DROP CONSTRAINT IF EXISTS flash_sale_valid_window;
ALTER TABLE "FlashSale"
  ADD CONSTRAINT flash_sale_valid_window CHECK ("endsAt" > "startsAt");

ALTER TABLE "FlashSaleItem" DROP CONSTRAINT IF EXISTS flash_sale_item_prices_non_negative;
ALTER TABLE "FlashSaleItem" DROP CONSTRAINT IF EXISTS flash_sale_item_sale_lte_original;
ALTER TABLE "FlashSaleItem" DROP CONSTRAINT IF EXISTS flash_sale_item_stock_valid;
ALTER TABLE "FlashSaleItem" DROP CONSTRAINT IF EXISTS flash_sale_item_per_user_limit_positive;
ALTER TABLE "FlashSaleItem"
  ADD CONSTRAINT flash_sale_item_prices_non_negative CHECK ("salePrice" >= 0 AND "originalPrice" >= 0),
  ADD CONSTRAINT flash_sale_item_sale_lte_original CHECK ("salePrice" <= "originalPrice"),
  ADD CONSTRAINT flash_sale_item_stock_valid CHECK ("stockLimit" >= 0 AND "soldCount" >= 0 AND "soldCount" <= "stockLimit"),
  ADD CONSTRAINT flash_sale_item_per_user_limit_positive CHECK ("perUserLimit" IS NULL OR "perUserLimit" > 0);

ALTER TABLE "MarketingBanner" DROP CONSTRAINT IF EXISTS marketing_banner_valid_window;
ALTER TABLE "MarketingBanner"
  ADD CONSTRAINT marketing_banner_valid_window CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt");

ALTER TABLE "DisputeCase" DROP CONSTRAINT IF EXISTS dispute_compensation_non_negative;
ALTER TABLE "DisputeCase"
  ADD CONSTRAINT dispute_compensation_non_negative CHECK ("compensation" IS NULL OR "compensation" >= 0);

CREATE INDEX IF NOT EXISTS shipping_provider_active_global_idx
  ON "ShippingProvider" ("isActive", "code")
  WHERE "shopId" IS NULL;

CREATE INDEX IF NOT EXISTS buyer_coin_ledger_expiring_idx
  ON "BuyerCoinLedger" ("expiresAt")
  WHERE "status" = 'AVAILABLE' AND "expiresAt" IS NOT NULL;

CREATE INDEX IF NOT EXISTS flash_sale_active_window_idx
  ON "FlashSale" ("startsAt", "endsAt")
  WHERE "status" IN ('SCHEDULED', 'ACTIVE');

CREATE INDEX IF NOT EXISTS marketing_banner_published_idx
  ON "MarketingBanner" ("placement", "sortOrder", "startsAt", "endsAt")
  WHERE "status" = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS support_ticket_open_idx
  ON "SupportTicket" ("priority", "updatedAt")
  WHERE "status" NOT IN ('RESOLVED', 'CLOSED');

CREATE INDEX IF NOT EXISTS product_question_published_idx
  ON "ProductQuestion" ("productId", "createdAt")
  WHERE "status" = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS product_answer_published_idx
  ON "ProductAnswer" ("questionId", "createdAt")
  WHERE "status" = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS report_export_active_idx
  ON "ReportExportJob" ("requestedById", "createdAt")
  WHERE "status" IN ('QUEUED', 'PROCESSING', 'COMPLETED');

-- =========================================================
-- Production Support Add-ons: Analytics, Moderation, Webhooks
-- =========================================================

-- Search logs should not store empty queries after normalization.
ALTER TABLE "SearchQueryLog" DROP CONSTRAINT IF EXISTS search_query_log_normalized_not_empty_chk;
ALTER TABLE "SearchQueryLog"
  ADD CONSTRAINT search_query_log_normalized_not_empty_chk
  CHECK (length(trim("normalizedQuery")) > 0);

ALTER TABLE "SearchQueryLog" DROP CONSTRAINT IF EXISTS search_query_log_result_count_non_negative_chk;
ALTER TABLE "SearchQueryLog"
  ADD CONSTRAINT search_query_log_result_count_non_negative_chk
  CHECK ("resultCount" >= 0);

-- Product/shop view logs should allow fast daily analytics aggregation.
CREATE INDEX IF NOT EXISTS product_view_logs_product_created_idx
  ON "ProductViewLog" ("productId", "createdAt");

CREATE INDEX IF NOT EXISTS shop_view_logs_shop_created_idx
  ON "ShopViewLog" ("shopId", "createdAt");

CREATE INDEX IF NOT EXISTS search_query_logs_query_created_idx
  ON "SearchQueryLog" ("normalizedQuery", "createdAt");

-- Only one active moderation case per entity/reason should exist at a time.
CREATE UNIQUE INDEX IF NOT EXISTS moderation_cases_one_active_per_entity_reason_idx
  ON "ModerationCase" ("entityType", "entityId", "reason")
  WHERE "status" IN ('OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED');

-- Resolved/dismissed moderation cases should have resolvedAt.
ALTER TABLE "ModerationCase" DROP CONSTRAINT IF EXISTS moderation_case_resolved_at_chk;
ALTER TABLE "ModerationCase"
  ADD CONSTRAINT moderation_case_resolved_at_chk
  CHECK (
    ("status" IN ('RESOLVED', 'DISMISSED') AND "resolvedAt" IS NOT NULL)
    OR ("status" NOT IN ('RESOLVED', 'DISMISSED'))
  );

-- Webhook events must have at least one dedupe key for safe replay handling.
ALTER TABLE "WebhookEvent" DROP CONSTRAINT IF EXISTS webhook_event_dedupe_key_chk;
ALTER TABLE "WebhookEvent"
  ADD CONSTRAINT webhook_event_dedupe_key_chk
  CHECK ("externalId" IS NOT NULL OR "idempotencyKey" IS NOT NULL);

ALTER TABLE "WebhookEvent" DROP CONSTRAINT IF EXISTS webhook_event_attempts_non_negative_chk;
ALTER TABLE "WebhookEvent"
  ADD CONSTRAINT webhook_event_attempts_non_negative_chk
  CHECK ("attempts" >= 0);

CREATE INDEX IF NOT EXISTS webhook_events_retry_idx
  ON "WebhookEvent" ("status", "receivedAt")
  WHERE "status" IN ('RECEIVED', 'FAILED');

-- Integration logs performance/safety checks.
ALTER TABLE "IntegrationLog" DROP CONSTRAINT IF EXISTS integration_log_duration_non_negative_chk;
ALTER TABLE "IntegrationLog"
  ADD CONSTRAINT integration_log_duration_non_negative_chk
  CHECK ("durationMs" IS NULL OR "durationMs" >= 0);

ALTER TABLE "IntegrationLog" DROP CONSTRAINT IF EXISTS integration_log_retry_count_non_negative_chk;
ALTER TABLE "IntegrationLog"
  ADD CONSTRAINT integration_log_retry_count_non_negative_chk
  CHECK ("retryCount" >= 0);

CREATE INDEX IF NOT EXISTS integration_logs_failed_recent_idx
  ON "IntegrationLog" ("provider", "operation", "createdAt")
  WHERE "status" IN ('FAILED', 'RETRYING');

-- =========================================================
-- Additional production indexes for marketplace query hot paths
-- =========================================================

-- Text search support for product listing/search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_title_trgm_idx
  ON "Product" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_slug_trgm_idx
  ON "Product" USING gin ("slug" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_title_th_trgm_idx
  ON "Product" USING gin ("titleTh" gin_trgm_ops)
  WHERE "titleTh" IS NOT NULL;

CREATE INDEX IF NOT EXISTS products_title_en_trgm_idx
  ON "Product" USING gin ("titleEn" gin_trgm_ops)
  WHERE "titleEn" IS NOT NULL;

-- Product browsing: fast active catalog pages and seller storefronts.
CREATE INDEX IF NOT EXISTS products_active_created_idx
  ON "Product" ("createdAt" DESC)
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS products_active_shop_created_idx
  ON "Product" ("shopId", "createdAt" DESC)
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS products_active_category_created_idx
  ON "Product" ("categoryId", "createdAt" DESC)
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL AND "categoryId" IS NOT NULL;

-- Order/admin dashboards.
CREATE INDEX IF NOT EXISTS orders_user_status_created_desc_idx
  ON "Order" ("userId", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS orders_payment_status_created_desc_idx
  ON "Order" ("paymentStatus", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS shop_orders_fulfillment_created_desc_idx
  ON "ShopOrder" ("shopId", "fulfillmentStatus", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS payments_status_created_desc_idx
  ON "Payment" ("status", "createdAt" DESC);

-- Review and moderation queues.
CREATE INDEX IF NOT EXISTS reviews_pending_created_idx
  ON "Review" ("createdAt" DESC)
  WHERE "status" = 'PENDING';

CREATE INDEX IF NOT EXISTS shop_ratings_pending_created_idx
  ON "ShopRating" ("createdAt" DESC)
  WHERE "status" = 'PENDING';

CREATE INDEX IF NOT EXISTS moderation_cases_queue_idx
  ON "ModerationCase" ("severity", "createdAt" DESC)
  WHERE "status" IN ('OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED');

-- Notifications and chat unread/recent flows.
CREATE INDEX IF NOT EXISTS notifications_unread_user_created_idx
  ON "Notification" ("userId", "createdAt" DESC)
  WHERE "readAt" IS NULL;

CREATE INDEX IF NOT EXISTS chat_threads_buyer_shop_recent_idx
  ON "ChatThread" ("buyerId", "shopId", "lastMessageAt" DESC);

CREATE INDEX IF NOT EXISTS chat_messages_thread_recent_idx
  ON "ChatMessage" ("threadId", "createdAt" DESC)
  WHERE "deletedAt" IS NULL;

-- Marketing/campaign hot paths.
CREATE INDEX IF NOT EXISTS flash_sales_live_window_idx
  ON "FlashSale" ("startsAt", "endsAt")
  WHERE "status" IN ('SCHEDULED', 'ACTIVE');

CREATE INDEX IF NOT EXISTS flash_sale_items_active_flash_sale_idx
  ON "FlashSaleItem" ("flashSaleId", "shopId")
  WHERE "isActive" = true;

-- Webhook and integration retry/debug flows.
CREATE INDEX IF NOT EXISTS webhook_events_provider_status_received_idx
  ON "WebhookEvent" ("provider", "status", "receivedAt" DESC);

CREATE INDEX IF NOT EXISTS integration_logs_provider_status_created_idx
  ON "IntegrationLog" ("provider", "status", "createdAt" DESC);
