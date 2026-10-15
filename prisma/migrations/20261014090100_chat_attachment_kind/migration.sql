-- CreateEnum
CREATE TYPE "ChatAttachmentKind" AS ENUM ('IMAGE', 'FILE');

-- AlterTable
ALTER TABLE "ChatAttachment" DROP COLUMN "kind",
ADD COLUMN     "kind" "ChatAttachmentKind" NOT NULL;
