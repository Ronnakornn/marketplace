DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShopViewEventType') THEN
    CREATE TYPE "ShopViewEventType" AS ENUM ('VIEW', 'FOLLOW', 'CHAT_OPEN');
  END IF;
END $$;

-- Older databases already had ShopViewLog. The consolidated initial migration
-- did not, so create the base table here to keep fresh migration chains valid.
CREATE TABLE IF NOT EXISTS "ShopViewLog" (
  "id" UUID NOT NULL,
  "shopId" UUID NOT NULL,
  "userId" UUID,
  "sessionId" TEXT,
  "source" TEXT,
  "referrer" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "metadata" JSONB,
  "eventType" "ShopViewEventType" NOT NULL DEFAULT 'VIEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopViewLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ShopViewLog"
ADD COLUMN IF NOT EXISTS "eventType" "ShopViewEventType" NOT NULL DEFAULT 'VIEW';

CREATE INDEX IF NOT EXISTS "ShopViewLog_shopId_createdAt_idx" ON "ShopViewLog"("shopId", "createdAt");
CREATE INDEX IF NOT EXISTS "ShopViewLog_userId_createdAt_idx" ON "ShopViewLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ShopViewLog_sessionId_createdAt_idx" ON "ShopViewLog"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "ShopViewLog_createdAt_idx" ON "ShopViewLog"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShopViewLog_shopId_fkey') THEN
    ALTER TABLE "ShopViewLog" ADD CONSTRAINT "ShopViewLog_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShopViewLog_userId_fkey') THEN
    ALTER TABLE "ShopViewLog" ADD CONSTRAINT "ShopViewLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
