-- AlterTable
ALTER TABLE "DisputeCase" ADD COLUMN     "returnRequestId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "DisputeCase_returnRequestId_key" ON "DisputeCase"("returnRequestId");

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
