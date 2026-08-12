import { PrismaCellControlProjectionRepository } from "./repository";
import { CellControlBootstrapService, type CellControlProjectionEnvelope } from "./projection";
import type { PrismaClient } from "@prisma/client";

/**
 * Safe, explicit bootstrap boundary for an already deployed customer cell.
 * The snapshot must be issued by the platform, signed, version 1, ACTIVE, and
 * match the deployment-owned CELL_ID. Database migrations never activate cells.
 */
export async function bootstrapExistingCellControlProjection(input: {
  cellId?: string;
  secret?: string;
  envelope: CellControlProjectionEnvelope;
  signature: string;
  database: PrismaClient;
}) {
  const cellId = input.cellId?.trim();
  if (!cellId) throw new Error("CELL_ID is required for control projection bootstrap");
  return new CellControlBootstrapService({
    cellId,
    secret: input.secret ?? "",
    repository: new PrismaCellControlProjectionRepository(input.database)
  }).bootstrap(input.envelope, input.signature);
}
