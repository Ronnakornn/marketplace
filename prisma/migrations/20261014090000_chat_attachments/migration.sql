-- AlterEnum
ALTER TYPE "ChatMessageType" ADD VALUE 'FILE';

-- CreateTable
CREATE TABLE "ChatAttachment" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "kind" "ChatMessageType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatAttachment_storageKey_key" ON "ChatAttachment"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAttachment_messageId_ordinal_key" ON "ChatAttachment"("messageId", "ordinal");

-- AddForeignKey
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
