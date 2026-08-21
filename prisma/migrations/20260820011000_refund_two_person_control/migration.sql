ALTER TABLE "Refund"
ADD COLUMN "processingById" UUID,
ADD COLUMN "completedById" UUID,
ADD COLUMN "externalReference" TEXT,
ADD COLUMN "processingAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3);

ALTER TABLE "Refund"
ADD CONSTRAINT "Refund_processingById_fkey"
FOREIGN KEY ("processingById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Refund"
ADD CONSTRAINT "Refund_completedById_fkey"
FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Refund_processingById_idx" ON "Refund"("processingById");
CREATE INDEX "Refund_completedById_idx" ON "Refund"("completedById");
