-- Retain SharedBusinessRecord_entityType_externalKey_key during nullable expand.
-- This tenant-scoped protection is additive until the later contract migration.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "SharedBusinessRecord_organizationId_entityType_externalKey_key"
  ON "SharedBusinessRecord"("organizationId", "entityType", "externalKey");
