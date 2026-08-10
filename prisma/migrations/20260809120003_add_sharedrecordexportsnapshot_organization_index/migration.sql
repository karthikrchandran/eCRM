-- One statement is required: Prisma/PostgreSQL otherwise wrap concurrent index
-- creation in a transaction block.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SharedRecordExportSnapshot_organizationId_idx"
  ON "SharedRecordExportSnapshot"("organizationId");
