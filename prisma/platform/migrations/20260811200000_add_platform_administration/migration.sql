ALTER TABLE "SupportGrant"
ADD COLUMN "actor" TEXT NOT NULL DEFAULT 'legacy-platform-admin',
ADD COLUMN "correlationId" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "revokedBy" TEXT,
ADD COLUMN "revocationReason" TEXT;

ALTER TABLE "SupportGrant"
ALTER COLUMN "actor" DROP DEFAULT,
ALTER COLUMN "correlationId" DROP DEFAULT;

CREATE INDEX "SupportGrant_correlationId_idx" ON "SupportGrant"("correlationId");
