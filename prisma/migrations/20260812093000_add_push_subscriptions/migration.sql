CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "endpointEncrypted" TEXT NOT NULL,
    "p256dhEncrypted" TEXT NOT NULL,
    "authEncrypted" TEXT NOT NULL,
    "locale" VARCHAR(2) NOT NULL DEFAULT 'th',
    "expirationTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpointHash_key" ON "PushSubscription"("endpointHash");
CREATE INDEX "PushSubscription_userId_createdAt_idx" ON "PushSubscription"("userId", "createdAt");

ALTER TABLE "PushSubscription"
ADD CONSTRAINT "PushSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
