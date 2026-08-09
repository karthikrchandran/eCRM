-- One statement is required: Prisma/PostgreSQL otherwise wrap concurrent index
-- creation in a transaction block.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Branch_organizationId_idx"
  ON "Branch"("organizationId");
