-- One statement is required: Prisma/PostgreSQL otherwise wrap concurrent index
-- creation in a transaction block.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalesTarget_organizationId_idx"
  ON "SalesTarget"("organizationId");
