CREATE TYPE "ShopViewEventType" AS ENUM ('VIEW', 'FOLLOW', 'CHAT_OPEN');

ALTER TABLE "ShopViewLog"
ADD COLUMN "eventType" "ShopViewEventType" NOT NULL DEFAULT 'VIEW';
