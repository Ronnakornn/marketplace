-- AlterTable
ALTER TABLE "ChatAttachment" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "contentVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "replyToAttachmentId" UUID,
ADD COLUMN     "replyToMessageId" UUID;

-- AlterTable
ALTER TABLE "ChatThread" ADD COLUMN     "contentRevision" BIGINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ChatMessage_replyToMessageId_idx" ON "ChatMessage"("replyToMessageId");

-- CreateIndex
CREATE INDEX "ChatMessage_replyToAttachmentId_idx" ON "ChatMessage"("replyToAttachmentId");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToAttachmentId_fkey" FOREIGN KEY ("replyToAttachmentId") REFERENCES "ChatAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
