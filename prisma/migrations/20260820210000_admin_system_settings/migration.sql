DO $$
BEGIN
  CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SystemSetting" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "valueType" "SettingValueType" NOT NULL DEFAULT 'JSON',
  "description" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_key_key" ON "SystemSetting"("key");
CREATE INDEX IF NOT EXISTS "SystemSetting_isPublic_idx" ON "SystemSetting"("isPublic");
