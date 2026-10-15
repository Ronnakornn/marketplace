ALTER TABLE "ChatThread"
ADD COLUMN "buyerReadMessageId" UUID,
ADD COLUMN "sellerReadMessageId" UUID;

CREATE INDEX "ChatMessage_threadId_createdAt_id_idx" ON "ChatMessage"("threadId", "createdAt", "id");
